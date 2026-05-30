import BirdApp from "@/components/BirdApp";

export default function Page() {
  const location = process.env.NEXT_PUBLIC_SITE_LOCATION || "";
  return <BirdApp location={location} />;
}
