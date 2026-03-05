/** 三点动画 loading 指示器 */
export function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-6 h-6 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
        <svg
          className="w-3 h-3 text-gray-500 dark:text-gray-400"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
        </svg>
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-gray-100 dark:bg-gray-800">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
