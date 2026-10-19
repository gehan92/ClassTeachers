import { useTranslations } from "next-intl";
import { Eyebrow } from "./eyebrow";

type LegalSection = { heading: string; paragraphs: string[] };

/**
 * Terms of service / privacy policy: plain-language sections from
 * messages/*.json ("termsPage" / "privacyPage"), with a contents list so a
 * reader can jump straight to the part they care about.
 */
export function LegalPage({ namespace, contactEmail }: { namespace: "termsPage" | "privacyPage"; contactEmail: string }) {
  const t = useTranslations(namespace);
  const tCommon = useTranslations("legalCommon");
  const sections = t.raw("sections") as LegalSection[];

  return (
    <section className="py-14">
      <div className="mx-auto max-w-[760px] px-5 sm:px-7">
        <Eyebrow>{tCommon("eyebrow")}</Eyebrow>
        <h1 className="text-[clamp(1.9rem,4.5vw,2.5rem)] leading-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{tCommon("updated", { date: t("updated") })}</p>
        <p className="mt-6 text-[17px] leading-relaxed text-foreground/90">{t("intro")}</p>

        <nav aria-label={tCommon("contents")} className="mt-8 rounded-xl border border-border bg-white p-5">
          <h2 className="mb-3 font-mono text-xs tracking-wider text-muted-foreground uppercase">{tCommon("contents")}</h2>
          <ol className="grid list-decimal gap-x-8 gap-y-1.5 pl-5 text-sm sm:grid-cols-2">
            {sections.map((section, i) => (
              <li key={section.heading}>
                <a href={`#section-${i + 1}`} className="text-primary underline-offset-2 hover:underline">
                  {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 flex flex-col gap-9">
          {sections.map((section, i) => (
            <div key={section.heading} id={`section-${i + 1}`} className="scroll-mt-24">
              <h2 className="text-xl">
                <span className="mr-2 font-mono text-base text-accent-deep">{i + 1}.</span>
                {section.heading}
              </h2>
              <div className="mt-3 flex flex-col gap-3 leading-relaxed text-foreground/85">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-xl bg-muted p-5 text-sm text-foreground/85">
          {contactEmail ? (
            <>
              {tCommon("questions")}{" "}
              <a href={`mailto:${contactEmail}`} className="font-semibold text-primary underline-offset-2 hover:underline">
                {contactEmail}
              </a>
            </>
          ) : (
            tCommon("questionsNoEmail")
          )}
        </div>
      </div>
    </section>
  );
}
