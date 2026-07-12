/**
 * The Academy's route transition — the same opacity-only fade as the Desk (§3.6).
 *
 * The rooms differ in structure and pace, never in how they move. A reader crossing a doorway
 * should feel the furniture change, not the physics.
 */
export default function AcademyTemplate({ children }: { children: React.ReactNode }) {
  return <div className="route-fade">{children}</div>;
}
