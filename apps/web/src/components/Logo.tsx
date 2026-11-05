/** Decorative app logo; pair it with visible text that names the app. */
export function Logo({
  size,
  className,
}: {
  size: number;
  className?: string;
}) {
  return (
    <img
      src="/logo.svg"
      alt=""
      width={size}
      height={size}
      className={className}
    />
  );
}
