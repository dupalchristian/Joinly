const S = ({ size = 20, children, sw = 1.8 }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

export const Plus = (p) => <S sw={2.4} {...p}><path d="M12 5v14M5 12h14" /></S>;
export const Back = (p) => <S sw={2} {...p}><path d="M15 5l-7 7 7 7" /></S>;
export const Close = (p) => <S sw={2} {...p}><path d="M6 6l12 12M18 6L6 18" /></S>;
export const Pin = (p) => <S {...p}><path d="M12 21s-6-5.6-6-10a6 6 0 0 1 12 0c0 4.4-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></S>;
export const Nav = (p) => <S sw={2} {...p}><path d="M3 11l18-8-8 18-2-8z" /></S>;
export const Chat = (p) => <S {...p}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></S>;
export const Bell = (p) => <S {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" /></S>;
export const Users = (p) => <S {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6" /></S>;
export const Share = (p) => <S {...p}><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></S>;
export const Car = (p) => <S {...p}><path d="M5 16V11l2-5h10l2 5v5M3 16h18M7 19v-3M17 19v-3" /><circle cx="7.5" cy="13" r=".6" /><circle cx="16.5" cy="13" r=".6" /></S>;
export const Trash = (p) => <S {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></S>;
export const Send = (p) => <S sw={2} {...p}><path d="M4 12l16-8-6 16-3-6z" /></S>;
export const Check = (p) => <S sw={2.4} {...p}><path d="M5 12l5 5 9-10" /></S>;

export function WeatherIcon({ kind, size = 18 }) {
  if (kind === 'sun') return <S size={size}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></S>;
  if (kind === 'rain') return <S size={size}><path d="M7 16h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 16z" /><path d="M9 21l1-2.5M13 21l1-2.5M17 21l1-2.5" /></S>;
  if (kind === 'snow') return <S size={size}><path d="M7 15h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 15z" /><path d="M9 19h.01M13 21h.01M17 19h.01" /></S>;
  return <S size={size}><path d="M7 18h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 18z" /></S>;
}
