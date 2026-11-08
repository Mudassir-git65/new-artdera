import { customizationSchema, isDecoraPrice, type CustomizationOption } from "../../src/lib/decora";
import { ApiError } from "../lib/http";
import { sanitizeText } from "../lib/security";

export function validateDecoraListing(input: {
  section?: string;
  decoraCategory?: string;
  price: number;
  discountPrice?: number;
  customizationOptions?: CustomizationOption[];
}) {
  if (input.section !== "decora") return;
  if (!input.decoraCategory)
    throw new ApiError(422, "DECORA_CATEGORY_REQUIRED", "Choose a Décora category");
  if (
    !isDecoraPrice(input.price) ||
    (input.discountPrice !== undefined &&
      (!isDecoraPrice(input.discountPrice) || input.discountPrice > input.price))
  )
    throw new ApiError(
      422,
      "DECORA_PRICE_LIMIT",
      "Décora prices, including personalization, must be above zero and at or below PKR 3,000. A discount cannot exceed the regular price.",
    );
}

export function validateCustomization(
  artwork: {
    section?: string;
    customizationOptions?: CustomizationOption[];
  },
  value: unknown,
) {
  const selections = customizationSchema.parse(value ?? []);
  const options = artwork.section === "decora" ? (artwork.customizationOptions ?? []) : [];
  if (
    new Set(selections.map((item) => item.label)).size !== selections.length ||
    selections.some((item) => !options.some((option) => option.label === item.label))
  )
    throw new ApiError(
      422,
      "INVALID_CUSTOMIZATION",
      "Review this product's personalization fields",
    );
  return options.flatMap((option) => {
    const selected = sanitizeText(
      selections.find((item) => item.label === option.label)?.value ?? "",
      300,
    ).trim();
    if (option.required && !selected)
      throw new ApiError(422, "CUSTOMIZATION_REQUIRED", `Please complete ${option.label}`);
    if (selected && option.choices.length && !option.choices.includes(selected))
      throw new ApiError(
        422,
        "INVALID_CUSTOMIZATION",
        `Choose an available option for ${option.label}`,
      );
    return selected ? [{ label: option.label, value: selected }] : [];
  });
}
