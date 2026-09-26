import { useEffect, useMemo, useState } from 'react';

// Cute, fair female interviewer aesthetic with varied long hair styles and accents
const FAIR_SKIN_PALETTES = [
  { base: '#fff2eb', shadow: '#fed7aa', blush: '#f43f5e', label: 'Porcelain Peach' },
  { base: '#fef3c7', shadow: '#fde68a', blush: '#fb7185', label: 'Warm Cream' },
  { base: '#fdf2f8', shadow: '#fce7f3', blush: '#ec4899', label: 'Rosy Fair' },
  { base: '#faeee5', shadow: '#f0d3c0', blush: '#f43f5e', label: 'Soft Ivory' },
];

const LONG_HAIR_STYLES = [
  { id: 'flowing-waves', label: 'Long Flowing Waves' },
  { id: 'sleek-long', label: 'Sleek Straight Long' },
  { id: 'side-swept', label: 'Side-Swept Long Locks' },
  { id: 'half-up', label: 'Half-Up Long Tendrils' },
];

const HAIR_COLORS = [
  { main: '#2c1810', highlight: '#4a2c1b', shadow: '#1a0e09', label: 'Rich Espresso' },
  { main: '#451a03', highlight: '#78350f', shadow: '#291002', label: 'Warm Chocolate' },
  { main: '#7c2d12', highlight: '#b45309', shadow: '#4d1a0a', label: 'Chestnut Amber' },
  { main: '#1c1917', highlight: '#292524', shadow: '#0c0a09', label: 'Silky Black' },
  { main: '#854d0e', highlight: '#ca8a04', shadow: '#583207', label: 'Honey Caramel' },
];

const EYE_COLORS = ['#0f766e', '#1e3a8a', '#78350f', '#065f46', '#3b0764'];

const CHIC_OUTFITS = [
  { blazer: '#0f766e', lapel: '#115e59', top: '#ffffff', accent: '#f59e0b' }, // Teal Blazer & White Silk
  { blazer: '#1e293b', lapel: '#0f172a', top: '#fce7f3', accent: '#ec4899' }, // Navy & Soft Rose
  { blazer: '#475569', lapel: '#334155', top: '#f0fdfa', accent: '#14b8a6' }, // Slate & Mint
  { blazer: '#7c2d12', lapel: '#5c1d0a', top: '#fffbeb', accent: '#f59e0b' }, // Rust & Ivory
  { blazer: '#581c87', lapel: '#3b0764', top: '#faf5ff', accent: '#d946ef' }, // Plum & Lavender
];

export const generateCuteWomanAvatarConfig = () => {
  const skin = FAIR_SKIN_PALETTES[Math.floor(Math.random() * FAIR_SKIN_PALETTES.length)];
  const hairStyle = LONG_HAIR_STYLES[Math.floor(Math.random() * LONG_HAIR_STYLES.length)];
  const hairColor = HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)];
  const outfit = CHIC_OUTFITS[Math.floor(Math.random() * CHIC_OUTFITS.length)];
  const eyeColor = EYE_COLORS[Math.floor(Math.random() * EYE_COLORS.length)];
  const earring = ['pearl', 'gold-hoop', 'crystal-stud'][Math.floor(Math.random() * 3)];

  return {
    skin,
    hairStyle: hairStyle.id,
    hairColor,
    outfit,
    eyeColor,
    earring,
    seed: Date.now() + Math.random(),
  };
};

export const generateRandomAvatarConfig = generateCuteWomanAvatarConfig;

export default function InterviewerAvatar({
  isSpeaking = false,
  expression = 'neutral', // 'neutral' | 'positive' | 'thoughtful'
  avatarConfig = null,
  onRegenerate = null,
  size = 180,
  showControls = true,
}) {
  const [internalConfig, setInternalConfig] = useState(() => generateCuteWomanAvatarConfig());
  const [mouthFrame, setMouthFrame] = useState(0);
  const [isBlinking, setIsBlinking] = useState(false);

  const config = avatarConfig || internalConfig;

  // Real mouth animation loop when speaking
  useEffect(() => {
    if (!isSpeaking) {
      setMouthFrame(0);
      return undefined;
    }

    const interval = setInterval(() => {
      setMouthFrame((prev) => (prev + 1) % 4);
    }, 130);

    return () => clearInterval(interval);
  }, [isSpeaking]);

  // Gentle natural blinking loop
  useEffect(() => {
    let timeoutId;
    let blinkInterval;

    const triggerBlink = () => {
      setIsBlinking(true);
      timeoutId = setTimeout(() => {
        setIsBlinking(false);
      }, 150);
    };

    blinkInterval = setInterval(() => {
      triggerBlink();
    }, 3500 + Math.random() * 1200);

    return () => {
      clearInterval(blinkInterval);
      clearTimeout(timeoutId);
    };
  }, []);

  const handleReRoll = () => {
    if (onRegenerate) {
      onRegenerate();
    } else {
      setInternalConfig(generateCuteWomanAvatarConfig());
    }
  };

  // Eyebrow curves based on expression
  const leftEyebrowTransform = useMemo(() => {
    if (expression === 'positive') return 'translate(0, -3.5)';
    if (expression === 'thoughtful') return 'rotate(-5 74 72) translate(0, 1)';
    return 'translate(0, 0)';
  }, [expression]);

  const rightEyebrowTransform = useMemo(() => {
    if (expression === 'positive') return 'translate(0, -3.5)';
    if (expression === 'thoughtful') return 'rotate(5 126 72) translate(0, -2)';
    return 'translate(0, 0)';
  }, [expression]);

  // Head tilt on expression
  const headTransform = useMemo(() => {
    if (expression === 'positive') return 'rotate(2 100 100) translate(0, -1)';
    if (expression === 'thoughtful') return 'rotate(-3 100 100) translate(0, 1)';
    return 'translate(0, 0)';
  }, [expression]);

  // Mouth states (cute lips with lip fill)
  const mouthPath = useMemo(() => {
    if (isSpeaking) {
      switch (mouthFrame) {
        case 0:
          // Wide open with teeth
          return {
            outer: 'M 91 136 Q 100 148 109 136 Q 100 130 91 136 Z',
            teeth: 'M 93 135 Q 100 138 107 135 L 106 137 Q 100 140 94 137 Z',
            tongue: 'M 95 145 Q 100 142 105 145 Q 100 148 95 145 Z',
          };
        case 1:
          // Soft round 'O' shape
          return {
            outer: 'M 94 135 Q 100 145 106 135 Q 100 129 94 135 Z',
            teeth: null,
            tongue: 'M 96 142 Q 100 140 104 142 Z',
          };
        case 2:
          // Medium smile talk
          return {
            outer: 'M 92 136 Q 100 145 108 136 Q 100 132 92 136 Z',
            teeth: 'M 94 135.5 Q 100 138 106 135.5 L 105.5 137 Q 100 139 94.5 137 Z',
            tongue: null,
          };
        case 3:
        default:
          // Narrow parted
          return {
            outer: 'M 93 137 Q 100 142 107 137 Q 100 134 93 137 Z',
            teeth: null,
            tongue: null,
          };
      }
    }

    // Resting smile states
    if (expression === 'positive') {
      return {
        line: 'M 88 135 Q 100 147 112 135',
        lipTop: 'M 91 135 Q 100 132 109 135',
        fill: '#fb7185',
      };
    }

    if (expression === 'thoughtful') {
      return {
        line: 'M 91 138 Q 100 137 109 138',
        lipTop: null,
        fill: null,
      };
    }

    // Neutral cute smile
    return {
      line: 'M 90 136 Q 100 143 110 136',
      lipTop: 'M 93 136 Q 100 133 107 136',
      fill: '#fb7185',
    };
  }, [isSpeaking, mouthFrame, expression]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: size,
          height: size,
          position: 'relative',
          borderRadius: '50%',
          boxShadow: isSpeaking
            ? '0 0 0 3px rgba(244, 63, 94, 0.4), 0 8px 24px rgba(15, 118, 110, 0.25)'
            : '0 4px 18px rgba(0, 0, 0, 0.12)',
          transition: 'box-shadow 0.25s ease',
          background: 'linear-gradient(135deg, #18211f 0%, #1a302b 100%)',
          overflow: 'hidden',
        }}
      >
        <svg
          viewBox="0 0 200 200"
          width="100%"
          height="100%"
          style={{ display: 'block', transition: 'transform 0.3s ease' }}
        >
          <defs>
            {/* Ambient Background Radial Glow */}
            <radialGradient id={`bgGlow-${config.seed}`} cx="50%" cy="40%" r="65%">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.18" />
              <stop offset="70%" stopColor="#0f766e" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
            </radialGradient>

            {/* Fair Radiant Skin Gradient */}
            <linearGradient id={`skinGrad-${config.seed}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={config.skin.base} />
              <stop offset="85%" stopColor={config.skin.base} />
              <stop offset="100%" stopColor={config.skin.shadow} />
            </linearGradient>

            {/* Hair Flow Gradient */}
            <linearGradient id={`hairGrad-${config.seed}`} x1="0" y1="0" x2="0.3" y2="1">
              <stop offset="0%" stopColor={config.hairColor.highlight} />
              <stop offset="40%" stopColor={config.hairColor.main} />
              <stop offset="100%" stopColor={config.hairColor.shadow} />
            </linearGradient>

            {/* Chic Blazer Gradient */}
            <linearGradient id={`blazerGrad-${config.seed}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={config.outfit.blazer} />
              <stop offset="100%" stopColor={config.outfit.lapel} />
            </linearGradient>
          </defs>

          {/* Background Ambient Glow */}
          <circle cx="100" cy="100" r="96" fill={`url(#bgGlow-${config.seed})`} />

          {/* Active Speaking Ring */}
          {isSpeaking && (
            <circle
              cx="100"
              cy="100"
              r="93"
              fill="none"
              stroke="#fb7185"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              opacity="0.85"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 100 100"
                to="360 100 100"
                dur="10s"
                repeatCount="indefinite"
              />
            </circle>
          )}

          {/* 1. BACK HAIR LAYER (Long cascading locks behind shoulders) */}
          <g id="avatar-back-hair">
            {/* Left flowing locks falling past shoulders */}
            <path
              d="M 64 65 C 45 90, 36 135, 42 200 L 72 200 C 65 155, 62 110, 74 75 Z"
              fill={`url(#hairGrad-${config.seed})`}
            />
            {/* Right flowing locks falling past shoulders */}
            <path
              d="M 136 65 C 155 90, 164 135, 158 200 L 128 200 C 135 155, 138 110, 126 75 Z"
              fill={`url(#hairGrad-${config.seed})`}
            />
            {/* Center back hair mass */}
            <path
              d="M 50 85 C 40 120, 42 165, 48 200 L 152 200 C 158 165, 160 120, 150 85 Z"
              fill={config.hairColor.shadow}
            />
          </g>

          {/* 2. BODY / CHIC BLAZER & BLOUSE */}
          <g id="avatar-body">
            {/* Shoulders */}
            <path
              d="M 32 200 C 36 154, 66 143, 100 145 C 134 143, 164 154, 168 200 Z"
              fill={`url(#blazerGrad-${config.seed})`}
            />

            {/* Elegant Silk Blouse V-neck */}
            <polygon points="86,145 100,172 114,145 100,138" fill={config.outfit.top} />

            {/* Dainty Gold Necklace & Pendant */}
            <path
              d="M 88 144 Q 100 158 112 144"
              stroke="#fbbf24"
              strokeWidth="1.2"
              fill="none"
            />
            <circle cx="100" cy="158" r="2" fill="#f59e0b" />

            {/* Blazer Lapels */}
            <path
              d="M 68 152 L 94 190 L 86 200 L 48 200 Z"
              fill={config.outfit.lapel}
              opacity="0.95"
            />
            <path
              d="M 132 152 L 106 190 L 114 200 L 152 200 Z"
              fill={config.outfit.lapel}
              opacity="0.95"
            />
          </g>

          {/* 3. HEAD & FACE GROUP (Animated on expression and speech) */}
          <g id="avatar-head" transform={headTransform} style={{ transition: 'transform 0.3s ease' }}>
            {/* Slender Neck */}
            <path
              d="M 90 114 L 110 114 L 114 148 C 105 151, 95 151, 86 148 Z"
              fill={config.skin.shadow}
            />

            {/* Cute Feminine Face Shape (Heart/Soft Oval) */}
            <path
              d="M 64 90 C 64 65, 80 50, 100 50 C 120 50, 136 65, 136 90 C 136 112, 124 130, 100 134 C 76 130, 64 112, 64 90 Z"
              fill={`url(#skinGrad-${config.seed})`}
            />

            {/* Dainty Ears with Earrings */}
            <ellipse cx="63" cy="95" rx="4.5" ry="8" fill={config.skin.shadow} />
            <ellipse cx="137" cy="95" rx="4.5" ry="8" fill={config.skin.shadow} />

            {/* Earrings */}
            {config.earring === 'pearl' && (
              <>
                <circle cx="63" cy="102" r="3.2" fill="#ffffff" stroke="#e2e8f0" strokeWidth="0.8" />
                <circle cx="137" cy="102" r="3.2" fill="#ffffff" stroke="#e2e8f0" strokeWidth="0.8" />
              </>
            )}
            {config.earring === 'gold-hoop' && (
              <>
                <circle cx="63" cy="103" r="3.5" fill="none" stroke="#f59e0b" strokeWidth="1.4" />
                <circle cx="137" cy="103" r="3.5" fill="none" stroke="#f59e0b" strokeWidth="1.4" />
              </>
            )}
            {config.earring === 'crystal-stud' && (
              <>
                <circle cx="63" cy="101" r="2.8" fill="#38bdf8" stroke="#ffffff" strokeWidth="0.8" />
                <circle cx="137" cy="101" r="2.8" fill="#38bdf8" stroke="#ffffff" strokeWidth="0.8" />
              </>
            )}

            {/* Soft Rosy Cheeks (Cute Blush) */}
            <ellipse cx="74" cy="104" rx="8" ry="4.5" fill={config.skin.blush} opacity="0.32" />
            <ellipse cx="126" cy="104" rx="8" ry="4.5" fill={config.skin.blush} opacity="0.32" />

            {/* Cute Delicate Eyebrows */}
            <g id="avatar-eyebrows">
              <path
                d="M 70 76 Q 80 71 89 74"
                stroke={config.hairColor.main}
                strokeWidth="2.4"
                strokeLinecap="round"
                fill="none"
                transform={leftEyebrowTransform}
                style={{ transition: 'transform 0.25s ease' }}
              />
              <path
                d="M 111 74 Q 120 71 130 76"
                stroke={config.hairColor.main}
                strokeWidth="2.4"
                strokeLinecap="round"
                fill="none"
                transform={rightEyebrowTransform}
                style={{ transition: 'transform 0.25s ease' }}
              />
            </g>

            {/* Cute Expressive Eyes with Eyelashes */}
            <g
              id="avatar-eyes"
              style={{
                transformOrigin: '100px 90px',
                transform: isBlinking ? 'scaleY(0.08)' : 'scaleY(1)',
                transition: 'transform 0.08s ease',
              }}
            >
              {/* Left Eye */}
              <ellipse cx="79" cy="89" rx="9" ry="6.5" fill="#ffffff" />
              <circle cx="79.5" cy="89" r="4.8" fill={config.eyeColor} />
              <circle cx="79.5" cy="89" r="2.4" fill="#09090b" />
              <circle cx="77.8" cy="87.5" r="1.5" fill="#ffffff" />
              <circle cx="81.2" cy="90.5" r="0.8" fill="#ffffff" />

              {/* Left Upper Eyelashes */}
              <path
                d="M 70 88 Q 79 83 88 88"
                stroke="#18181b"
                strokeWidth="2.2"
                strokeLinecap="round"
                fill="none"
              />
              <path d="M 86 86 L 89 83" stroke="#18181b" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M 87 87 L 91 85" stroke="#18181b" strokeWidth="1.4" strokeLinecap="round" />

              {/* Right Eye */}
              <ellipse cx="121" cy="89" rx="9" ry="6.5" fill="#ffffff" />
              <circle cx="120.5" cy="89" r="4.8" fill={config.eyeColor} />
              <circle cx="120.5" cy="89" r="2.4" fill="#09090b" />
              <circle cx="118.8" cy="87.5" r="1.5" fill="#ffffff" />
              <circle cx="122.2" cy="90.5" r="0.8" fill="#ffffff" />

              {/* Right Upper Eyelashes */}
              <path
                d="M 112 88 Q 121 83 130 88"
                stroke="#18181b"
                strokeWidth="2.2"
                strokeLinecap="round"
                fill="none"
              />
              <path d="M 114 86 L 111 83" stroke="#18181b" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M 113 87 L 109 85" stroke="#18181b" strokeWidth="1.4" strokeLinecap="round" />
            </g>

            {/* Cute Button Nose */}
            <path
              d="M 98 94 Q 100 108 97 111 Q 100 113 103 111"
              stroke={config.skin.shadow}
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />

            {/* Cute Rosy Lips & Mouth */}
            <g id="avatar-mouth">
              {isSpeaking && mouthPath.outer ? (
                <>
                  <path d={mouthPath.outer} fill="#4c0519" stroke="#fb7185" strokeWidth="1.5" />
                  {mouthPath.teeth && <path d={mouthPath.teeth} fill="#ffffff" />}
                  {mouthPath.tongue && <path d={mouthPath.tongue} fill="#f43f5e" />}
                </>
              ) : (
                <>
                  {/* Subtle top lip glow */}
                  {mouthPath.lipTop && (
                    <path
                      d={mouthPath.lipTop}
                      stroke="#fb7185"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      fill="none"
                      opacity="0.75"
                    />
                  )}
                  {/* Smile baseline */}
                  <path
                    d={mouthPath.line}
                    stroke="#e11d48"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    fill="none"
                    style={{ transition: 'd 0.2s ease' }}
                  />
                  {/* Bottom lip soft cushion */}
                  <path
                    d="M 94 138 Q 100 142 106 138"
                    stroke="#fca5a5"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    fill="none"
                    opacity="0.8"
                  />
                </>
              )}
            </g>

            {/* 4. FRONT HAIR LAYER (Long flowing bangs and front tendrils) */}
            <g id="avatar-front-hair">
              {/* Soft Side-Parted Long Bangs */}
              <path
                d="M 58 78 C 56 42, 85 36, 100 36 C 125 36, 142 46, 142 82 C 134 54, 115 48, 96 52 C 78 56, 66 65, 58 78 Z"
                fill={`url(#hairGrad-${config.seed})`}
              />

              {/* Elegant Left Tendril falling past jawline */}
              <path
                d="M 60 76 C 54 100, 56 128, 64 150 C 68 135, 66 105, 72 82 Z"
                fill={`url(#hairGrad-${config.seed})`}
              />

              {/* Elegant Right Tendril falling past jawline */}
              <path
                d="M 140 76 C 146 100, 144 128, 136 150 C 132 135, 134 105, 128 82 Z"
                fill={`url(#hairGrad-${config.seed})`}
              />

              {/* Hair Highlight Stroke */}
              <path
                d="M 75 48 Q 95 44 115 48"
                stroke={config.hairColor.highlight}
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                opacity="0.6"
              />
            </g>
          </g>
        </svg>

        {/* Live Status Badge */}
        <div
          style={{
            position: 'absolute',
            bottom: 6,
            left: '50%',
            transform: 'translateX(-50%)',
            background: isSpeaking ? 'var(--pri)' : 'rgba(24, 33, 31, 0.85)',
            color: '#ffffff',
            padding: '2px 8px',
            borderRadius: 99,
            fontSize: '0.68rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(4px)',
            transition: 'background 0.2s ease',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: isSpeaking ? '#2dd4bf' : expression === 'positive' ? '#10b981' : expression === 'thoughtful' ? '#f59e0b' : '#94a3b8',
              display: 'inline-block',
            }}
          />
          {isSpeaking ? 'Speaking' : expression === 'positive' ? 'Impressed' : expression === 'thoughtful' ? 'Evaluating' : 'Listening'}
        </div>
      </div>

      {showControls && (
        <button
          type="button"
          className="ghost"
          onClick={handleReRoll}
          style={{
            padding: '4px 10px',
            fontSize: '0.78rem',
            color: 'var(--mut)',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
          title="Switch look or style"
        >
          ✨ Switch Look
        </button>
      )}
    </div>
  );
}
