import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
      <div className="text-[13px] font-semibold text-text-2">404</div>
      <h1 className="m-0 text-[22px] font-bold tracking-tight text-text-1">This page doesn’t exist</h1>
      <p className="m-0 max-w-xs text-[14.5px] text-text-2">
        The page you’re looking for may have moved or never existed.
      </p>
      <Link
        href="/today"
        className="mt-3 rounded-sm bg-text-1 px-5 py-2.5 text-[14px] font-semibold text-bg"
      >
        Back to Today
      </Link>
    </div>
  );
}
