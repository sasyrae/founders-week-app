import SpeakerSelf from "@/components/SpeakerSelf";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your speaker profile — Flybridge Founders Week",
  robots: { index: false, follow: false }, // private link, keep it out of search
};

export default async function Page({ params }) {
  const { token } = await params;
  return <SpeakerSelf token={token} />;
}
