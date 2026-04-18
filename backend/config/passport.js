import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

import User from "../models/user.js";

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error);
    }
});

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: process.env.GOOGLE_CALLBACK_URL,
            },
            async (_accessToken, _refreshToken, profile, done) => {
                try {
                    const email = profile.emails?.[0]?.value?.toLowerCase();
                    const avatarUrl = profile.photos?.[0]?.value || null;

                    if (!email) {
                        return done(new Error("Google account email is required."));
                    }

                    const existingByGoogle = await User.findOne({ googleId: profile.id });
                    if (existingByGoogle) {
                        if (avatarUrl && existingByGoogle.avatarUrl !== avatarUrl) {
                            existingByGoogle.avatarUrl = avatarUrl;
                            await existingByGoogle.save();
                        }

                        return done(null, existingByGoogle);
                    }

                    const existingByEmail = await User.findOne({ email });
                    if (existingByEmail) {
                        if (!existingByEmail.googleId) {
                            existingByEmail.googleId = profile.id;
                        }

                        if (avatarUrl && existingByEmail.avatarUrl !== avatarUrl) {
                            existingByEmail.avatarUrl = avatarUrl;
                        }

                        await existingByEmail.save();

                        return done(null, existingByEmail);
                    }

                    const user = await User.create({
                        name: profile.displayName || profile.name?.givenName || "Google User",
                        email,
                        googleId: profile.id,
                        avatarUrl,
                    });

                    return done(null, user);
                } catch (error) {
                    return done(error);
                }
            }
        )
    );
}

export default passport;
