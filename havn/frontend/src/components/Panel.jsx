function Panel({ children, className = "", style }) {
  return (
    <div
      style={style}
      className={`w-full h-full min-w-0 min-h-0 rounded-none border-0 md:rounded-2xl md:border border-slate-700 bg-slate-900 flex overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

export default Panel;
