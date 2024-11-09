import {
    Drawer,
    DrawerTrigger,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
  } from "@/components/ui/drawer";
  import Link from "next/link";
  
  interface Column {
    columnTitle: string;
    columnItems: string[];
  }
  
  interface HeaderDrawerProps {
    title: string;
    description: string;
    subtitleDescription: string;
    columns: Column[];
  }
  
  export const HeaderDrawer = ({
    title,
    description,
    subtitleDescription,
    columns,
  }: HeaderDrawerProps) => {
    return (
      <Drawer>
        <DrawerTrigger>{title}</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-lg font-bold">{description}</DrawerTitle>
            <DrawerDescription>{subtitleDescription}</DrawerDescription>
          </DrawerHeader>
          <div className="grid xl:grid-cols-4 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-4">
            {columns.map((column, index) => (
              <div key={index} className="col-span-1 p-4 flex flex-col items-center">
                <h3 className="font-bold  ">{column.columnTitle}</h3>
                {column.columnItems.map((item, itemIndex) => (
                  <Link href="/" className="flex my-2" key={itemIndex}>
                    {item}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    );
  };