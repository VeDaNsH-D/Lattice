import React, { useRef, useEffect } from 'react';
import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion';
import { Link } from 'react-router-dom';
import styles from './LandingBody.module.css';
import { BrainCircuit, Link2, Database, Radio, Flame, MessageSquare, Zap, Video } from 'lucide-react';
import uiImage from '../assets/ui-img.png';

const numberVariants = {
  hidden: { opacity: 0, y: 80 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 60, damping: 12 }
  }
};

const AnimatedCounter = ({ from = 0, to, duration = 2 }) => {
  const count = useMotionValue(from);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });

  useEffect(() => {
    if (isInView) {
      const controls = animate(count, to, {
        duration: duration,
        ease: "easeOut",
      });
      return () => controls.stop();
    }
  }, [count, to, duration, isInView]);

  return <motion.span ref={ref}>{rounded}</motion.span>;
};

export const LandingBody = () => {
  return (
    <div className={styles.pageWrapper}>
      <main className={styles.mainCard}>

        {/* ─────────────────────────────────────────
            ABOUT US SECTION
        ───────────────────────────────────────── */}
        <section className={styles.about_aboutSection}>
          <div className={styles.about_row}>
            <div className={styles.about_leftCol}>
              <span className={styles.about_label}>THE PROBLEM</span>
            </div>
            <div className={styles.about_rightCol}>
              <h2 className={styles.about_heading}>
                <span className={styles.about_textDark}>We hoard bookmarks, lose valuable information, and struggle to revisit knowledge. </span>
                <span className={styles.about_textLight}>The result is a "Digital Graveyard" of unused links. Shelflife turns passive saving into active knowledge management.</span>
              </h2>
            </div>
          </div>

          <div className={styles.about_row} style={{ alignItems: 'flex-start' }}>
            <div className={styles.about_leftCol}>
              <span className={styles.about_label}>THE SOLUTION</span>
              <h3 className={styles.about_subHeading}>A Living Ecosystem</h3>
              <p className={styles.about_paragraph}>
                Understand content instantly, collaborate in real-time, and let unused knowledge decay naturally. Your bookmarks should work for you, not the other way around.
              </p>
            </div>
            <motion.div
              className={styles.about_rightCol}
              initial={{ opacity: 0, scale: 1.15 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              viewport={{ once: true, amount: 0.2 }}
            >
              <img
                src={uiImage}
                alt="Organized digital knowledge workspace"
                className={styles.about_heroImage}
              />
            </motion.div>
          </div>
        </section>

        {/* ─────────────────────────────────────────
            SCATTERED FEATURES SECTION
        ───────────────────────────────────────── */}
        <section className={styles.scattered_section}>
          <div className={styles.scattered_container}>
            <div className={styles.scattered_left}>
              <h2 className={styles.scattered_headline}>
                <span className={styles.scattered_highlight}>Systems</span> that scale your intellect.
              </h2>
              <p className={styles.scattered_subtext}>
                Get access to world-class AI, real-time collaboration, and intelligent decay mechanics to accelerate your team's workflow from day one.
              </p>
              <button className={styles.scattered_btn}>Explore Features</button>

              <div className={styles.scattered_handIcon}>💡</div>
            </div>

            <div className={styles.scattered_right}>
              <div className={styles.scattered_cardsWrapper}>
                <div className={`${styles.scattered_card} ${styles.scattered_card1}`}>
                  <div className={styles.scattered_icon}>🧠</div>
                  <h4>Smart Link Ingestion</h4>
                  <p>Paste any URL. AI automatically generates summaries, tags, and vibes instantly via Microlink.</p>
                </div>
                <div className={`${styles.scattered_card} ${styles.scattered_card2}`}>
                  <div className={styles.scattered_icon}>⏳</div>
                  <h4>Biological Decay System</h4>
                  <p>Inactive links fade after 14 days and move to the graveyard after 30. Keep your workspace clean.</p>
                </div>
                <div className={`${styles.scattered_card} ${styles.scattered_card3}`}>
                  <div className={styles.scattered_icon}>🔍</div>
                  <h4>Spotlight Search</h4>
                  <p>Fuzzy, semantic search across titles, summaries, and tags to find exactly what you learned.</p>
                </div>
                <div className={`${styles.scattered_card} ${styles.scattered_card4}`}>
                  <div className={styles.scattered_icon}>💬</div>
                  <h4>Collaborative Comments</h4>
                  <p>Discuss knowledge with your team via real-time WebSocket comments powered by GIPHY.</p>
                </div>
                <div className={`${styles.scattered_card} ${styles.scattered_card5}`}>
                  <div className={styles.scattered_icon}>🎥</div>
                  <h4>WebRTC Voice & Video</h4>
                  <p>Jump into live audio or video calls directly inside your shared projects to discuss saves.</p>
                </div>
                <div className={`${styles.scattered_card} ${styles.scattered_card6}`}>
                  <div className={styles.scattered_icon}>📊</div>
                  <h4>Activity Logs</h4>
                  <p>Track your interacton. See what you learned this week and convert usage into actionable insight.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────
            FEATURES SECTION
        ───────────────────────────────────────── */}
        <section className={styles.feature_featuresSection}>
          <div className={styles.feature_titleRow}>
            <div className={styles.feature_leftCol}>
              <span className={styles.feature_label}>INTELLIGENCE</span>
            </div>
            <div className={styles.feature_rightCol}>
              <h2 className={styles.feature_heading}>An AI-powered knowledge layer</h2>
            </div>
          </div>

          <div className={styles.feature_bentoGrid}>
            <div className={`${styles.feature_card} ${styles.feature_card1}`}>
              <div className={styles.feature_card1Content}>
                <h4 className={styles.feature_cardHead}>Chat with your saved bookmarks.</h4>
                <p className={styles.feature_cardDesc}>
                  Ask Shelflife to "Explain this simply" or extract key takeaways directly from the content you ingested.
                </p>
              </div>
              <div className={styles.feature_card1Mockup}>
                <div className={styles.feature_mockFacebook}>
                  <div className={styles.feature_mockTabs}>
                    <div className={styles.feature_mockTab} style={{ background: '#f1f5f9' }}>AI Insights</div>
                    <div className={styles.feature_mockTab} style={{ background: 'transparent', color: '#94a3b8' }}>Original Context</div>
                  </div>
                  <div className={styles.feature_mockContent}>
                    <p style={{ marginBottom: '16px' }}>Here is a simplified explanation of WebRTC architecture based on your saved articles:</p>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ color: '#94a3b8' }}>📁</span> <b>Peer-to-Peer Connections</b>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ color: '#94a3b8' }}>🔗</span> <span>WebRTC bypasses central servers to stream video directly.</span>
                    </div>
                  </div>
                </div>
                <motion.div
                  className={styles.feature_mockChat}
                  animate={{ y: [0, -8, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                >
                  Can you summarize the top 3 WebRTC signaling methods?
                  <div className={styles.feature_mockChatInput}>
                    <span style={{ color: '#cbd5e1' }}>Cohere Semantic Search •</span>
                    <span>🎤 ➢</span>
                  </div>
                </motion.div>
              </div>
            </div>

            <div className={`${styles.feature_card} ${styles.feature_card2}`}>
              <h4 className={styles.feature_cardHead}>Auto-generation & Tagging</h4>
              <p className={styles.feature_cardDesc}>
                Links are automatically classified by topic, vibe, and activity, making filtering instantaneous.
              </p>
              <div className={styles.feature_pillsContainer}>
                {[
                  { text: 'topic: AI Ethics', bg: '#1e293b', color: 'white', bottom: '60px', left: '20px', rot: '-5deg', delay: 0 },
                  { text: 'vibe: inspiring', bg: '#fca5a5', color: '#7f1d1d', bottom: '20px', left: '10px', rot: '-10deg', delay: 1 },
                  { text: 'topic: WebRTC', bg: '#60a5fa', color: 'white', bottom: '30px', left: '120px', rot: '-12deg', delay: 0.5 },
                  { text: 'activity: review', bg: '#fdba74', color: '#9a3412', bottom: '10px', left: '200px', rot: '-2deg', delay: 1.5 },
                  { text: 'topic: Next.js', bg: '#06b6d4', color: 'white', bottom: '80px', left: '240px', rot: '-15deg', delay: 0.2 },
                  { text: 'vibe: deep-dive', bg: '#3b82f6', color: 'white', bottom: '50px', left: '300px', rot: '-10deg', delay: 0.8 },
                  { text: 'type: tutorial', bg: '#fef08a', color: '#854d0e', bottom: '15px', left: '320px', rot: '0deg', delay: 1.2 },
                  { text: 'topic: APIs', bg: '#94a3b8', color: 'white', bottom: '65px', left: '420px', rot: '-15deg', delay: 0.3 },
                  { text: 'activity: summarize', bg: '#0f172a', color: 'white', bottom: '40px', left: '500px', rot: '-8deg', delay: 0.9 },
                ].map((pill, i) => (
                  <motion.div
                    key={i}
                    className={styles.feature_pill}
                    style={{ background: pill.bg, color: pill.color, bottom: pill.bottom, left: pill.left, transform: `rotate(${pill.rot})` }}
                    animate={{ y: [0, -6, 0] }}
                    transition={{ repeat: Infinity, duration: 4, delay: pill.delay, ease: "easeInOut" }}
                  >
                    {pill.text}
                  </motion.div>
                ))}
              </div>
            </div>

            <div className={`${styles.feature_card} ${styles.feature_card3}`}>
              <h4 className={styles.feature_cardHead}>Voice & Screen Share</h4>
              <p className={styles.feature_cardDesc}>
                Open an Agora real-time room to debate articles or share your screen directly inside your project.
              </p>
              <div className={styles.feature_voiceContainer}>
                <div className={styles.feature_soundwaveWrapper}>
                  <motion.svg
                    width="240" height="60" viewBox="0 0 240 60" fill="none" stroke="url(#gradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                    animate={{ scaleY: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  >
                    <defs>
                      <linearGradient id="gradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                        <stop offset="30%" stopColor="#0066ff" stopOpacity="0.5" />
                        <stop offset="50%" stopColor="#0066ff" stopOpacity="1" />
                        <stop offset="70%" stopColor="#0066ff" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M10 30L40 30L55 10L70 50L85 5L100 45L115 15L130 55L145 20L160 40L175 25L190 30L230 30" />
                  </motion.svg>
                </div>
                <div className={styles.feature_micIcon}>
                  <div className={styles.feature_micLine} />
                  <div className={styles.feature_micLine} style={{ width: '32px' }} />
                  <div className={styles.feature_micLine} style={{ width: '24px' }} />
                  <div className={styles.feature_micStand} />
                  <div className={styles.feature_micBase} />
                </div>
              </div>
            </div>

            <div className={`${styles.feature_card} ${styles.feature_card4}`}>
              <h4 className={styles.feature_cardHead}>Powered by deeply integrated APIs</h4>
              <p className={styles.feature_cardDesc}>
                Leveraging OpenAPI for summarization, Cohere for semantic similarity, and Microlink for robust metadata extraction.
              </p>
              <div className={styles.feature_modelGrid}>
                <div className={styles.feature_iconSlot}><BrainCircuit size={24} color="#10b981" /></div>
                <div className={styles.feature_iconSlot}><Database size={24} color="#f59e0b" /></div>
                <div className={styles.feature_iconSlot}><Link2 size={24} color="#3b82f6" /></div>
                <div className={styles.feature_iconSlot}><Radio size={24} color="#8b5cf6" /></div>
                <div className={styles.feature_iconSlot}><Flame size={24} color="#ef4444" /></div>
                <div className={styles.feature_iconSlot}><Video size={24} color="#06b6d4" /></div>
                <div className={styles.feature_iconSlot}><MessageSquare size={24} color="#ec4899" /></div>
                <div className={styles.feature_iconSlot}><Zap size={24} color="#eab308" /></div>
              </div>
            </div>

            <div className={`${styles.feature_card} ${styles.feature_card5}`}>
              <h4 className={styles.feature_cardHead}>Real-time Feedback</h4>
              <p className={styles.feature_cardDesc}>
                Comments, reactions, and live additions are synced instantaneously with Socket.io.
              </p>
              <div className={styles.feature_codeWindow}>
                <span className={styles.feature_htmlTag}>&#123;</span><br />
                &nbsp;&nbsp;<span className={styles.feature_htmlAttr}>"link_id"</span>: <span className={styles.feature_htmlString}>"shr_89f2a"</span>,<br />
                &nbsp;&nbsp;<span className={styles.feature_htmlAttr}>"url"</span>: <span className={styles.feature_htmlString}>"https://example.com/guide"</span>,<br />
                &nbsp;&nbsp;<span className={styles.feature_htmlAttr}>"status"</span>: <span className={styles.feature_htmlString}>"active"</span>,<br />
                &nbsp;&nbsp;<span className={styles.feature_htmlAttr}>"decay_state"</span>: <span className={styles.feature_htmlTag}>1.0</span>,<br />
                &nbsp;&nbsp;<span className={styles.feature_htmlAttr}>"comments"</span>: <span className={styles.feature_htmlTag}>[</span><br />
                &nbsp;&nbsp;&nbsp;&nbsp;<span className={styles.feature_htmlTag}>&#123;</span><br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className={styles.feature_htmlAttr}>"user"</span>: <span className={styles.feature_htmlString}>"alex_dev"</span>,<br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className={styles.feature_htmlAttr}>"message"</span>: <span className={styles.feature_htmlString}>"This solves our auth issue!"</span>,<br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className={styles.feature_htmlAttr}>"giphy_url"</span>: <span className={styles.feature_htmlString}>"https://media.giphy.com/..."</span><br />
                &nbsp;&nbsp;&nbsp;&nbsp;<span className={styles.feature_htmlTag}>&#125;</span><br />
                &nbsp;&nbsp;<span className={styles.feature_htmlTag}>]</span><br />
                <span className={styles.feature_htmlTag}>&#125;</span><br />
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────
            STATS SECTION
        ───────────────────────────────────────── */}
        <section className={styles.stats_statsSection}>
          <motion.div
            className={styles.stats_grid}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.1 }}
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.2 } }
            }}
          >
            <div className={styles.stats_column}>
              <span className={styles.stats_label}>HOURS RECLAIMED</span>
              <motion.h2 variants={numberVariants} className={styles.stats_number}>
                <AnimatedCounter to={500} duration={2.5} />k
              </motion.h2>
              <p className={styles.stats_paragraph}>
                Stop digging through endless unread tabs. Shelflife's AI semantic search instantly retrieves what you remembered learning.
              </p>
              <img
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80"
                alt="Students collaborating"
                className={styles.stats_image}
              />
            </div>

            <div className={`${styles.stats_column} ${styles.stats_rightColumn}`}>
              <span className={styles.stats_label}>DEAD LINKS DECAYED</span>
              <motion.h2 variants={numberVariants} className={styles.stats_number}>
                <AnimatedCounter to={2} duration={2} />M+
              </motion.h2>
              <p className={styles.stats_paragraph}>
                Our Biological Decay system naturally fades unused links after 14 days, pruning your workspace and removing digital clutter.
              </p>
              <img
                src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=800&q=80"
                alt="Minimalist desk"
                className={styles.stats_image}
              />
            </div>
          </motion.div>
        </section>

        {/* ─────────────────────────────────────────
            TESTIMONIALS CAROUSEL
        ───────────────────────────────────────── */}
        <section className={styles.test_section}>
          <div className={styles.test_header}>
            <span className={styles.test_label}>COMMUNITY</span>
            <h2 className={styles.test_title}>Loved by researchers & devs</h2>
            <p className={styles.test_subtitle}>See what active knowledge workers have to say about the end of the digital graveyard.</p>
          </div>

          <div className={styles.test_carouselContainer}>
            <div className={styles.test_track}>
              {[...Array(2)].map((_, i) => (
                <div key={i} className={styles.test_group}>
                  {[
                    { name: "Sarah Jenkins", role: "Product Designer", msg: "The biological decay feature is genius. It forces me to actually read what I save or let it naturally fade away.", img: "https://randomuser.me/api/portraits/women/44.jpg" },
                    { name: "David Chen", role: "Frontend Engineer", msg: "Being able to chat with all my saved React documentation links is like having a perfectly tuned second brain.", img: "https://randomuser.me/api/portraits/men/32.jpg" },
                    { name: "Priya Sharma", role: "UX Researcher", msg: "We use the team workspace to compile user feedback. The real-time comments and Agoro WebRTC integration are flawless.", img: "https://randomuser.me/api/portraits/women/68.jpg" },
                    { name: "Marcus Webb", role: "Technical Writer", msg: "Microlink auto-fetching metadata means I never have to manually tag anything again. Shelflife does it magically.", img: "https://randomuser.me/api/portraits/men/84.jpg" },
                    { name: "Elena Rostova", role: "Computer Science Student", msg: "My unread tabs used to give me anxiety. Shelflife organized the chaos and actually helped me learn.", img: "https://randomuser.me/api/portraits/women/24.jpg" }
                  ].map((t, idx) => (
                    <div key={idx} className={styles.test_card}>
                      <div className={styles.test_stars}>
                        ★★★★★
                      </div>
                      <p className={styles.test_quote}>"{t.msg}"</p>
                      <div className={styles.test_author}>
                        <img src={t.img} alt={t.name} loading="lazy" />
                        <div>
                          <h4>{t.name}</h4>
                          <span>{t.role}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────
            CTA SECTION
        ───────────────────────────────────────── */}
        <section className={styles.cta_ctaSection}>
          <div className={styles.cta_watermark}>SHELFLIFE</div>
          <div className={styles.cta_content}>
            <h2 className={styles.cta_headline}>Bring your bookmarks back to life.</h2>
            <p className={styles.cta_subtitle}>Join thousands of forward-thinking users turning passive saving into active knowledge curation.</p>
            <div className={styles.cta_buttonGroup}>
              <Link to="/signup" style={{ textDecoration: 'none' }}><button className={styles.cta_buttonSolid}>Start for free</button></Link>
              <button className={styles.cta_buttonOutline}>View Demo</button>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
};
