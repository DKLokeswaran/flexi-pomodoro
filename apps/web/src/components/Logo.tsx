/**
 * Decorative app logo; pair it with visible text that names the app.
 * `size` is pixels as a number, or any CSS length such as "1.2em".
 */
export function Logo({
  size,
  className,
}: {
  size: number | string;
  className?: string;
}) {
  return (
    <img
      src="/logo.svg"
      alt=""
      style={{ width: size, height: size }}
      className={className}
    />
  );
}
