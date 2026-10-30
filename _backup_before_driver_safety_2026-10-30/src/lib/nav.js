import { CarTaxiFront, IndianRupee, LayoutDashboard, Map, Route, Siren, Users } from 'lucide-react';

export const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'map', label: 'Live map', icon: Map },
  { id: 'sos', label: 'SOS desk', icon: Siren },
  { id: 'rides', label: 'Rides', icon: Route },
  { id: 'fleet', label: 'Fleet health', icon: CarTaxiFront },
  { id: 'drivers', label: 'Drivers', icon: Users },
  { id: 'tariff', label: 'Tariff', icon: IndianRupee },
];
