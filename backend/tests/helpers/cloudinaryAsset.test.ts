import { describe, expect, it } from "vitest";

import {
  isCloudinaryAssetUrl,
  ownedPublicIdFor,
} from "../../src/cloudinary/cloudinaryAsset.ts";

describe("cloudinary asset ownership", () => {
  it("extracts the public id of an owned asset", () => {
    expect(
      ownedPublicIdFor(
        "https://res.cloudinary.com/demo/image/upload/v1/pos/users/avatar.jpg",
      ),
    ).toBe("pos/users/avatar");
  });

  it("keeps dots inside a public id", () => {
    expect(
      ownedPublicIdFor(
        "https://res.cloudinary.com/demo/image/upload/pos/users/avatar.v2.png",
      ),
    ).toBe("pos/users/avatar.v2");
  });

  it("rejects provider and foreign URLs", () => {
    expect(
      isCloudinaryAssetUrl("https://lh3.googleusercontent.com/a/avatar.png"),
    ).toBe(false);
    expect(isCloudinaryAssetUrl("https://evil.test/pos/users/avatar.jpg")).toBe(
      false,
    );
    expect(isCloudinaryAssetUrl("not a url")).toBe(false);
    expect(isCloudinaryAssetUrl(undefined)).toBe(false);
  });

  it("rejects a Cloudinary URL outside our root folder", () => {
    expect(
      isCloudinaryAssetUrl(
        "https://res.cloudinary.com/demo/image/upload/other/avatar.jpg",
      ),
    ).toBe(false);
  });
});
