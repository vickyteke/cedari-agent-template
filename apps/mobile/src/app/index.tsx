import { Redirect, type Href } from "expo-router";
import { initialHref } from "../lib/navigation";
export default function Entry() {
  return <Redirect href={initialHref as Href} />;
}
