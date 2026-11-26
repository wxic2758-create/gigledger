export const locales = [
  { code: "en", folder: "en", htmlLang: "en", dir: "ltr", label: "English" },
  { code: "zh-TW", folder: "zh-TW", htmlLang: "zh-Hant-TW", dir: "ltr", label: "繁體中文" },
  { code: "zh-CN", folder: "zh-CN", htmlLang: "zh-Hans-CN", dir: "ltr", label: "简体中文" },
];

export const supportedLocale = (value) => locales.find(({ code }) => code === value)?.code ?? "en";
