export default function Illustration({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "illustration small" : "illustration"}
      viewBox="0 0 360 270"
      role="img"
      aria-label="סל קניות עם עגבנייה ואבוקדו מצוירים, דמויות זמניות"
    >
      <defs>
        <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#e7b8ac" opacity=".35" />
        </pattern>
      </defs>
      <ellipse
        cx="183"
        cy="238"
        rx="120"
        ry="16"
        fill="#e9c6b7"
        opacity=".35"
      />
      <path
        d="M48 76q-18-25-28-6t28 37q41-30 29-40T48 76"
        fill="#edafbb"
        transform="rotate(-12 48 80)"
      />
      <path d="M303 122q-10-16-18-5t18 25q26-19 19-29t-19 9" fill="#edafbb" />
      <path
        d="m278 47 4-11m8 21 12-3m-25 22 9 6M84 33l-4-11M65 48l-11-1"
        stroke="#cf9f66"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M89 160q-22-75 25-100 41-20 52 48l6 66"
        fill="#bad8a4"
        stroke="#66554a"
        strokeWidth="3.5"
      />
      <path d="M102 142q-15-58 17-68 24-7 33 53l7 38" fill="#e6edb9" />
      <ellipse cx="130" cy="132" rx="21" ry="27" fill="#bd805a" />
      <circle cx="108" cy="108" r="3" fill="#59453d" />
      <circle cx="139" cy="102" r="3" fill="#59453d" />
      <path d="m119 110 5 3 5-5" stroke="#59453d" strokeWidth="2" fill="none" />
      <ellipse cx="102" cy="118" rx="6" ry="4" fill="#e7a5a2" />
      <path
        d="M207 158q-36-20-24-59t42-21q42-13 52 21 13 47-30 67"
        fill="#efa08c"
        stroke="#66554a"
        strokeWidth="3.5"
      />
      <path
        d="m225 80-16-17 19 7 10-18 1 19 19-6-13 17"
        fill="#9db67e"
        stroke="#66554a"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="210" cy="114" r="3" fill="#59453d" />
      <circle cx="246" cy="114" r="3" fill="#59453d" />
      <path
        d="M221 121q6 8 13 0"
        fill="none"
        stroke="#59453d"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <ellipse cx="202" cy="124" rx="7" ry="4" fill="#e48283" />
      <ellipse cx="255" cy="124" rx="7" ry="4" fill="#e48283" />
      <path
        d="M163 153q-6-61 14-70 22-9 26 58"
        fill="#f4d69e"
        stroke="#66554a"
        strokeWidth="3"
      />
      <path
        d="m173 101 13 4m-15 13 15 3"
        stroke="#c59f70"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="m65 149 25 81q3 9 15 9h142q10 0 13-10l24-80"
        fill="#f7d0af"
        stroke="#66554a"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="m65 149 25 81q3 9 15 9h142q10 0 13-10l24-80" fill="url(#dots)" />
      <rect
        x="56"
        y="139"
        width="239"
        height="20"
        rx="10"
        fill="#fff0d9"
        stroke="#66554a"
        strokeWidth="3.5"
      />
      <path
        d="m115 139 37-49m85 49-37-49"
        fill="none"
        stroke="#66554a"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M175 209q-32-20-19-33 10-8 19 4 10-12 20-4 13 13-20 33"
        fill="#da8e9c"
      />
      <path
        d="m103 175 9 43m29-43 4 43m66-43-4 43m38-43-9 43"
        stroke="#dda984"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M40 183q-9 8 0 16t12-5m263-25q9 8 0 16t-12-5"
        fill="none"
        stroke="#b4c8a4"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
