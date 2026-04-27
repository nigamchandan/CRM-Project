export default function Modal({ open, title, children, onClose, footer, size = 'md' }) {
  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`bg-white dark:bg-slate-900 dark:border dark:border-slate-700 rounded-xl shadow-xl w-full ${sizes[size]} overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-slate-100">{title}</h3>
          <button
            className="text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-200 text-xl leading-none"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto text-gray-800 dark:text-slate-200">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
