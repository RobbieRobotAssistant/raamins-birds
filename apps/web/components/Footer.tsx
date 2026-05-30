export default function Footer() {
  return (
    <footer className="mx-auto w-full max-w-5xl px-5 py-10 text-center sm:px-8">
      <p className="chrome">
        a website by{" "}
        <a
          href="https://www.raaminmostaghimi.com"
          target="_blank"
          rel="noreferrer"
          className="text-ink underline underline-offset-4 hover:text-accent"
        >
          raamin mostaghimi
        </a>
      </p>
      <p className="chrome mt-2">
        heavily inspired by and extended from{" "}
        <a
          href="https://theodore.net/projects/AvianVisitors/"
          target="_blank"
          rel="noreferrer"
          className="text-ink underline underline-offset-4 hover:text-accent"
        >
          teddy
        </a>
      </p>
    </footer>
  );
}
