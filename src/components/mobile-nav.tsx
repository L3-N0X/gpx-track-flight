"use client";

import { useState } from "react";
import { Link } from "react-router";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Button } from "./ui/button";
import { getNavbarRoutes } from "../routes";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const navbarRoutes = getNavbarRoutes();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="md:hidden">
          <Menu className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-4 mt-6">
          {navbarRoutes.map((route) => (
            <Link
              key={route.path}
              to={route.path}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-lg font-medium text-foreground hover:text-primary transition-colors"
            >
              {route.title}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
