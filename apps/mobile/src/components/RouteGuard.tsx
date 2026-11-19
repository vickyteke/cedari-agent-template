import { Redirect, usePathname } from 'expo-router';
import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { initialHref, routeAvailable } from '../lib/navigation';
export function RouteGuard({children}:{children:ReactNode}) {
 const path=usePathname();
 return routeAvailable(path)?children:<Redirect href={initialHref as Href}/>;
}
