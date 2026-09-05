function Panel({ children, className = "" }) {
  return (
    <div
      className={`w-full h-full rounded-2xl border border-slate-700 bg-slate-900 flex overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

export default Panel;
