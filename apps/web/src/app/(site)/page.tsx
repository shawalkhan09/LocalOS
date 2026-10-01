import fs from "node:fs";
import path from "node:path";
import { HomeSections } from "./_components/home/HomeSections";

export default function HomePage() {
  const hasHero = fs.existsSync(path.join(process.cwd(), "public/images/hero.jpg"));
  return <HomeSections hasHero={hasHero} />;
}
