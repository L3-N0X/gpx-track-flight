"use client";

import { Link } from "react-router";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "./ui/navigation-menu";
import { getNavbarRoutes } from "../routes";

export function Navbar() {
  const navbarRoutes = getNavbarRoutes();

  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <Link to="/">
            <div className="flex items-center h-10 px-2 sm:px-4">
              <img src="/aquamagica.svg" alt="Logo" className="h-6 w-6 sm:h-8 sm:w-8 mr-2" />
              <span className="text-lg sm:text-2xl font-semibold font-logo">AQUAMAGICA</span>
            </div>
          </Link>
        </NavigationMenuItem>
        {navbarRoutes.map((route) => (
          <NavigationMenuItem key={route.path} className="hidden md:block">
            <NavigationMenuLink className={navigationMenuTriggerStyle()} href={route.path}>
              {route.title}
            </NavigationMenuLink>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
