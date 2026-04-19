import React, { useEffect, useState } from 'react';
import { Command } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL, apiRequest } from '../utils/api';
import './AuthPage.css';

const AUTH_MODE_COPY = {
  signup: {
    title: 'Create Account',
    buttonLabel: 'Create Account',
    submitEndpoint: '/auth/signup',
    toggleText: 'Already have an account?',
    toggleLinkLabel: 'Login',
    toggleLinkTo: '/login',
    toggleLinkState: { fromAuthPage: true },
    successMessage: 'Account created successfully. Redirecting...',
    headline: 'Create an account and\nbring beauty to every\nmoment.',
  },
  login: {
    title: 'Welcome Back',
    buttonLabel: 'Login',
    submitEndpoint: '/auth/login',
    toggleText: "Don't have an account?",
    toggleLinkLabel: 'Sign up',
    toggleLinkTo: '/signup',
    toggleLinkState: { fromAuthPage: true },
    successMessage: 'Logged in successfully. Redirecting...',
    headline: 'Welcome back and\ncontinue building\nbeautiful moments.',
  },
};

const getErrorMessage = (error) => {
  if (!error) {
    return 'Something went wrong. Please try again.';
  }

  if (error?.data?.errors?.length) {
    return error.data.errors.map((entry) => entry.message).join(', ');
  }

  return error.message || 'Something went wrong. Please try again.';
};

export const AuthPage = ({ mode = 'signup' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const copy = AUTH_MODE_COPY[mode] || AUTH_MODE_COPY.signup;
  const queryParams = new URLSearchParams(location.search);
  const tokenFromGoogle = queryParams.get('token');
  const redirectTarget = queryParams.get('redirect');
  const googleAuthError = queryParams.get('error') === 'google_auth_failed';

  const [formState, setFormState] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [lottieComponent, setLottieComponent] = useState(null);
  const [animationData, setAnimationData] = useState(null);
  const LottieComponent = lottieComponent;

  useEffect(() => {
    document.title = mode === 'login' ? 'Login | LATTICE' : 'Sign Up | LATTICE';
  }, [mode]);

  useEffect(() => {
    let isMounted = true;

    const loadAnimationAssets = async () => {
      try {
        const [lottieModule, animationResponse] = await Promise.all([
          import('lottie-react'),
          fetch('/illustration.json'),
        ]);

        const resolvedAnimationData = animationResponse.ok
          ? await animationResponse.json()
          : null;

        if (!isMounted) {
          return;
        }

        const resolvedLottie = typeof lottieModule?.default === 'function'
          ? lottieModule.default
          : lottieModule;

        setLottieComponent(() => resolvedLottie);
        setAnimationData(resolvedAnimationData);
      } catch {
        if (isMounted) {
          setLottieComponent(null);
          setAnimationData(null);
        }
      }
    };

    void loadAnimationAssets();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (tokenFromGoogle) {
      localStorage.setItem('token', tokenFromGoogle);
      navigate(redirectTarget || '/lattice', { replace: true });
    }
  }, [tokenFromGoogle, redirectTarget, navigate]);

  const onInputChange = (event) => {
    const { name, value } = event.target;
    setFormState((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const payload =
        mode === 'signup'
          ? {
            name: formState.name.trim(),
            email: formState.email.trim(),
            password: formState.password,
          }
          : {
            email: formState.email.trim(),
            password: formState.password,
          };

      const response = await apiRequest(copy.submitEndpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response?.token) {
        throw new Error('Token not found in response.');
      }

      localStorage.setItem('token', response.token);
      setSuccessMessage(copy.successMessage);
      navigate(redirectTarget || '/lattice', { replace: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const onGoogleSignIn = () => {
    const frontendOrigin = encodeURIComponent(window.location.origin);
    window.location.assign(`${API_BASE_URL}/auth/google?frontend=${frontendOrigin}`);
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">

        {/* LEFT COLUMN */}
        <div className="auth-left">
          <Link to="/" className="auth-brand" style={{ textDecoration: 'none' }}>
            <Command size={24} color="white" strokeWidth={2.5} />
            LATTICE
          </Link>

          <h1 className="auth-headline">
            {copy.headline.split('\n').map((line, index) => (
              <React.Fragment key={`${mode}-headline-${index}`}>
                {line}
                <br />
              </React.Fragment>
            ))}
          </h1>

          <div className="auth-lottie">
            {LottieComponent && animationData ? (
              <LottieComponent
                animationData={animationData}
                loop={true}
                style={{ width: '100%', height: '100%', maxHeight: '420px', objectFit: 'contain' }}
              />
            ) : null}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="auth-right">
          <h2 className="auth-title">{copy.title}</h2>

          <form onSubmit={onSubmit} className="auth-form">
            {mode === 'signup' ? (
              <fieldset className="auth-fieldset">
                <legend>Name</legend>
                <input
                  type="text"
                  className="auth-input"
                  name="name"
                  value={formState.name}
                  onChange={onInputChange}
                  autoComplete="name"
                  required
                  disabled={loading}
                />
              </fieldset>
            ) : null}

            <fieldset className="auth-fieldset">
              <legend>Email</legend>
              <input
                type="email"
                className="auth-input"
                name="email"
                value={formState.email}
                onChange={onInputChange}
                autoComplete="email"
                required
                disabled={loading}
              />
            </fieldset>

            <fieldset className="auth-fieldset">
              <legend>Password</legend>
              <input
                type="password"
                className="auth-input"
                name="password"
                value={formState.password}
                onChange={onInputChange}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                disabled={loading}
              />
            </fieldset>

            <button type="submit" className="auth-submitBtn" disabled={loading}>
              {loading ? 'Please wait...' : copy.buttonLabel}
            </button>

            <div className="auth-divider" aria-hidden="true">
              <span className="auth-dividerLine" />
              <span className="auth-dividerText">or</span>
              <span className="auth-dividerLine" />
            </div>

            <button
              type="button"
              className="auth-googleBtn"
              onClick={onGoogleSignIn}
              disabled={loading}
            >
              <span className="auth-googleMark" aria-hidden="true">
                <svg viewBox="0 0 48 48" width="20" height="20" focusable="false" aria-hidden="true">
                  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.655 32.91 29.237 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.041l5.657-5.657C34.184 6.053 29.358 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z" />
                  <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.041l5.657-5.657C34.184 6.053 29.358 4 24 4c-7.392 0-13.844 4.19-17.094 10.691z" />
                  <path fill="#4CAF50" d="M24 44c5.196 0 9.918-1.989 13.479-5.23l-6.22-5.238C29.238 35.091 26.782 36 24 36c-5.216 0-9.619-3.063-11.289-7.436l-6.523 5.03C9.404 39.556 16.104 44 24 44z" />
                  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a11.92 11.92 0 01-4.044 5.532l.003-.002 6.22 5.238C36.904 39.07 44 34 44 24c0-1.341-.138-2.651-.389-3.917z" />
                </svg>
              </span>
              Continue with Google
            </button>

            {errorMessage || googleAuthError ? <p className="auth-feedback auth-feedback-error">{errorMessage || 'Google sign-in failed. Please try again.'}</p> : null}
            {successMessage ? <p className="auth-feedback auth-feedback-success">{successMessage}</p> : null}

            <div className="auth-toggleText">
              {copy.toggleText} <Link to={copy.toggleLinkTo} state={copy.toggleLinkState} className="auth-toggleLink">{copy.toggleLinkLabel}</Link>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};
