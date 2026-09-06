import { Link } from "react-router";
import Logo from "./Logo";

function SiteFooter() {
  return (
    <footer className="bg-[#141311] text-[#A89F92]">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="max-w-xs lg:col-span-2">
          <span className="text-[#FAF7F2]">
            <Logo size={28} />
          </span>
          <p className="mt-4 text-sm leading-relaxed">A calmer place to talk. Private by default.</p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A7E70]">Product</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <Link to="/" className="hover:text-[#FAF7F2] transition-colors">Home</Link>
            </li>
            <li>
              <Link to="/login" className="hover:text-[#FAF7F2] transition-colors">Sign in</Link>
            </li>
            <li>
              <Link to="/signup" className="hover:text-[#FAF7F2] transition-colors">Get started</Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A7E70]">Legal</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <Link to="/privacy" className="hover:text-[#FAF7F2] transition-colors">Privacy Policy</Link>
            </li>
            <li>
              <Link to="/terms" className="hover:text-[#FAF7F2] transition-colors">Terms of Service</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[#2A2420]">
        <div className="mx-auto max-w-6xl px-6 py-5 text-sm">© 2026 Havn. All rights reserved.</div>
      </div>
    </footer>
  );
}

export default SiteFooter;
