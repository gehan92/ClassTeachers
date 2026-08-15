import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Missing keys in si/ta fall back to English at runtime instead of
    // failing the build — translation work can lag without blocking ship.
    onError: (error) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn(error.message);
      }
    },
    getMessageFallback: ({ namespace, key, error }) => {
      if (error.code === "MISSING_MESSAGE") {
        return namespace ? `${namespace}.${key}` : key;
      }
      return key;
    },
  };
});
