import { useTheme } from '../context/ThemeContext.jsx';
import { Icon } from './Icons.jsx';

/** Floating light/dark toggle, bottom-right (matches the artifact). */
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button className="themebtn" type="button" onClick={toggle} title="Toggle theme">
      <Icon name={isDark ? 'i-sun' : 'i-moon'} />
      {isDark ? 'Light' : 'Dark'}
    </button>
  );
}
