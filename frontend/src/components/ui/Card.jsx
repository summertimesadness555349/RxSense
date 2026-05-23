export default function Card({ children, className = '', hover = true, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800
        rounded-xl p-4 transition-all duration-200
        ${hover ? 'hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-md dark:hover:shadow-emerald-900/20' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
