import { Outlet } from "react-router-dom";

/** Wraps `/business/:businessId/*`; each child supplies its own header + main. */
export default function BusinessLayout() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-neutral-100">
      <Outlet />
    </div>
  );
}
