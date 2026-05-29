import BirdApp from "@/components/BirdApp";

export default function Page() {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Garden Birds";
  const location = process.env.NEXT_PUBLIC_SITE_LOCATION || "";
  return <BirdApp siteName={siteName} location={location} />;
}
