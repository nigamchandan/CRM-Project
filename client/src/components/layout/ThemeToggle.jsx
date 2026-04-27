import Icon from '../ui/Icon.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';

export default function ThemeToggle({ className = '' }) {
  const { isDark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors ${className}`}
    >
      <Icon name={isDark ? 'sun' : 'moon'} className="w-5 h-5" />
    </button>
  );
}
