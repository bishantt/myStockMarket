import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * lib/routes-manifest.json — THE ONE LIST OF ROOMS (G3), parsed. check:nav and check:bundles both
 * read it; every rule they then apply to it stays inside the guard that owns the rule.
 */
export function readRoutesManifest(root = process.cwd()) {
  return JSON.parse(readFileSync(join(root, "lib", "routes-manifest.json"), "utf8"));
}

/**
 * Every app/** /page.tsx as the URL path it serves. check:routes and check:bundles share this exact
 * walk — check-bundles' own comment used to read "same inventory rule as check-routes.mjs".
 *
 * We walk the FILESYSTEM rather than trust the manifest alone, because the failure check:routes fears
 * is a route that exists and is dynamic — a purely manifest-driven inventory would happily report
 * "all routes cached" about a set that quietly excluded the broken one. The app-path-routes-manifest
 * is consulted only for the mapping the filesystem cannot give: how a route-group's parentheses
 * collapse out of the URL ("(desk)/scans/page" → "/scans").
 *
 * Returns { file: "app/…", route, key }, sorted by route, filtered to the paths the manifest knows.
 * A caller that wants a narrower set (check:bundles drops _not-found / _global-error) filters itself.
 */
export function routeInventory(root = process.cwd()) {
  const appPaths = JSON.parse(
    readFileSync(join(root, ".next", "app-path-routes-manifest.json"), "utf8"),
  );
  const pages = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules" || entry === ".next") continue;
        walk(full);
      } else if (entry === "page.tsx") {
        pages.push(relative(join(root, "app"), full));
      }
    }
  };
  walk(join(root, "app"));

  return pages
    .map((file) => {
      const key = "/" + file.replace(/\.tsx$/, "");
      return { file: `app/${file}`, route: appPaths[key] ?? null, key };
    })
    .filter((r) => r.route !== null)
    .sort((a, b) => a.route.localeCompare(b.route));
}
