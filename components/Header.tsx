import Link from "next/link";
import { HeaderDrawer } from "./HeaderDrawer";

function Header() {
  const trainningColumns = [
    {
      columnTitle: "Metrics",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
    {
      columnTitle: "Analitcs",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
    {
      columnTitle: "Menu",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
    {
      columnTitle: "Suppliers",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
  ];

  const featuresColumns = [
    {
      columnTitle: "Metrics",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
    {
      columnTitle: "Analitcs",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
    {
      columnTitle: "Menu",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
    {
      columnTitle: "Suppliers",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
  ];

  const aboutColumns = [
    {
      columnTitle: "Metrics",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
    {
      columnTitle: "Analitcs",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
    {
      columnTitle: "Menu",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
    {
      columnTitle: "Suppliers",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
  ];

  return (
    <header className="bg-yellow-400 h-16 flex justify-between align-middle">
      <div className="flex items-center ml-5">
        <Link href="/">
          <h3>IMPERIUM</h3>
        </Link>
      </div>
      <div className="flex items-center gap-8">
        <HeaderDrawer
          title="Trainning"
          description="Get ready to take control"
          subtitleDescription="Video links on how to handle the application"
          columns={trainningColumns}
        />
        <HeaderDrawer
          title="Features"
          description="Unleash the full power of the application"
          subtitleDescription="Video links on how to handle the application"
          columns={featuresColumns}
        />
        <HeaderDrawer
          title="About"
          description="Our values, history and mission"
          subtitleDescription="Video links on how to handle the application"
          columns={aboutColumns}
        />
      </div>
      <h1 className="text-2xl font-bold">used to be clerk</h1>
    </header>
  );
}

export default Header;
