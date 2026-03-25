# Cloudinary Full Test TODO

Goal: fully validate Cloudinary actions used by the backend routes, with a simple flow and no overcomplication.

Reference documentation (must be followed): [Cloudinary React SDK docs](https://cloudinary.com/documentation/react_integration).

## Before starting

- [x] Mandatory pre-step for this task: read this entire file (`cloudinary-full-test-todo.md`) before executing.
- [x] Confirm backend server is running (`backend` -> `npm run dev`).
- [x] Confirm `.env` has Cloudinary vars:
  - [x] `CLOUDINARY_CLOUD_NAME`
  - [x] `CLOUDINARY_API_KEY`
  - [x] `CLOUDINARY_API_SECRET`
- [x] Keep one image file ready for tests (`frontend/public/imperium.png`).
- [x] Keep a second image file ready for replacement tests (`frontend/src/assets/hero.png`).
- [x] Keep one non-image file ready for negative test (`not-image.txt`).
- [x] Pick one test businessId and one test userId from dummy data (`businessId=64b000000000000000000001`, `userId=64b000000000000000000101`).

## Phase 1 - Upload success tests

### 1.1 Business image upload
- [x] Mandatory pre-step for this task: read this entire file (`cloudinary-full-test-todo.md`) before executing.
- [x] Send multipart request to update business image (`PATCH /api/v1/business/:businessId`).
- [x] Confirm response is success (`200`).
- [x] Fetch business and confirm `imageUrl` is an `https://` Cloudinary URL.
- [x] In Cloudinary Media Library, confirm file exists in expected folder.

Result:
- API `PATCH` returned `200` with `{"message":"Business updated successfully"}`
- Business `imageUrl` after update:
  - `https://res.cloudinary.com/jpsm83/image/upload/v1774426086/restaurant-pos/business/64b000000000000000000001/we5h1axwtqzqblwiiben.png`
- Cloudinary folder/prefix contains assets:
  - `restaurant-pos/business/64b000000000000000000001/`

What we had to change to make this pass (replicate for other models if needed):
- Fix 1 (ESM/CJS interop causing `objDefaultValidation is not a function`)
  - Added `lib/package.json` with `"type": "module"` so `backend` (ESM) can import `lib/**/*.ts` default exports correctly under NodeNext.
- Fix 2 (deleting non-Cloudinary existing image URLs)
  - Updated `backend/src/cloudinary/deleteFilesCloudinary.ts` to no-op when the existing `imageUrl` isn’t a Cloudinary `restaurant-pos/...` asset (dummy data had `https://cdn.example.com/...`).
- Fix 3 (better Cloudinary error visibility)
  - Updated `backend/src/cloudinary/uploadFilesCloudinary.ts` to stringify non-`Error` thrown values for clearer diagnostics.

Command used (reliable on Windows when curl quoting breaks JSON fields):

```bash
node -e "(async()=>{const fs=require('fs'); const {Blob}=require('buffer'); const fd=new FormData(); fd.append('tradeName','Demo Bistro'); fd.append('legalName','Demo Bistro LLC'); fd.append('email','demo-bistro@restaurantpos.test'); fd.append('phoneNumber','+351910000001'); fd.append('taxNumber','PT500000001'); fd.append('subscription','Free'); fd.append('currencyTrade','EUR'); fd.append('address',JSON.stringify({country:'Portugal',state:'Lisbon',city:'Lisbon',street:'Rua Central',buildingNumber:'100',postCode:'1000-001'})); const buf=fs.readFileSync('C:/Users/jpdesouza/Documents/code/restaurant-pos/frontend/public/imperium.png'); fd.append('imageUrl', new Blob([buf],{type:'image/png'}), 'imperium.png'); const res=await fetch('http://localhost:4000/api/v1/business/64b000000000000000000001',{method:'PATCH',body:fd}); console.log('STATUS',res.status); console.log(await res.text());})().catch(e=>{console.error(e); process.exit(1);});"
```

#### Status after task 1.1
- ✅ Phase 1 / 1.1 completed
- ⏭️ Next: Phase 1 / 1.2

### 1.2 User image upload
- [x] Mandatory pre-step for this task: read this entire file (`cloudinary-full-test-todo.md`) before executing.
- [x] Send multipart request to update user image (`PATCH /api/v1/users/:userId`).
- [x] Confirm response is success (`200`).
- [x] Fetch user and confirm `personalDetails.imageUrl` is updated with Cloudinary URL.

Result:
- API `PATCH` returned `200` with `{"message":"User updated successfully!"}`
- User `personalDetails.imageUrl` after update:
  - `https://res.cloudinary.com/jpsm83/image/upload/v1774427905/restaurant-pos/users/64b000000000000000000101/darhxjyipx1njlzzepyk.png`
- Cloudinary folder/prefix contains assets:
  - `restaurant-pos/users/64b000000000000000000101/`
  - Found public_id:
    - `restaurant-pos/users/64b000000000000000000101/darhxjyipx1njlzzepyk`

Notes / payload shape (important for replication):
- `PATCH /api/v1/users/:userId` validates `address` using `objDefaultValidation`.
- When sending `address`, omit Mongo `_id` from the address object, otherwise validation fails with `Invalid key: _id`.

Command used (Node fetch + FormData; avoids curl JSON quoting issues):

```bash
node -e "(async()=>{const fs=require('fs'); const {Blob}=require('buffer'); const fd=new FormData(); fd.append('username','manager-user'); fd.append('email','manager@restaurantpos.test'); fd.append('idType','National ID'); fd.append('idNumber','USR-MANAGER-001'); const addr={country:'Portugal',state:'Lisbon',city:'Lisbon',street:'Rua Manager',buildingNumber:'11',postCode:'1000-101',region:'Lisbon Metropolitan Area',additionalDetails:'Apartment 2A',coordinates:[-9.142,38.719]}; fd.append('address',JSON.stringify(addr)); fd.append('firstName','Marta'); fd.append('lastName','Manager'); fd.append('nationality','Portuguese'); fd.append('gender','Woman'); fd.append('birthDate','1992-01-15T00:00:00.000Z'); fd.append('phoneNumber','+351910000101'); const buf=fs.readFileSync('C:/Users/jpdesouza/Documents/code/restaurant-pos/frontend/public/imperium.png'); fd.append('imageUrl', new Blob([buf],{type:'image/png'}), 'imperium.png'); const res=await fetch('http://localhost:4000/api/v1/users/64b000000000000000000101',{method:'PATCH',body:fd}); console.log('STATUS',res.status); console.log(await res.text());})().catch(e=>{console.error(e); process.exit(1);});"
```

#### Status after task 1.2
- ✅ Phase 1 / 1.2 completed
- ⏭️ Next: Phase 1 / 1.3

### 1.3 Supplier image upload (optional if you already have supplier test data)
- [x] Mandatory pre-step for this task: read this entire file (`cloudinary-full-test-todo.md`) before executing.
- [x] Send multipart request for supplier image update/create.
- [x] Confirm response is success (`200`).
- [x] Confirm supplier `imageUrl` is updated and file exists in Cloudinary.

Result (using existing supplier test data):
- Endpoint: `PATCH /api/v1/suppliers/64b000000000000000000601`
- API response: `{"message":"Supplier updated successfully!"}` with HTTP `200`
- Updated supplier `imageUrl`:
  - `https://res.cloudinary.com/jpsm83/image/upload/v1774428109/restaurant-pos/business/64b000000000000000000001/suppliers/64b000000000000000000601/qjpmzweewh0ircdaget4.png`
- Cloudinary verification (expected prefix contains the asset):
  - Prefix: `restaurant-pos/business/64b000000000000000000001/suppliers/64b000000000000000000601/`
  - Found public id:
    - `restaurant-pos/business/64b000000000000000000001/suppliers/64b000000000000000000601/qjpmzweewh0ircdaget4`

Payload shape notes (replication):
- `PATCH /api/v1/suppliers/:supplierId` requires `tradeName`, `legalName`, `email`, `phoneNumber`, `taxNumber`, `currentlyInUse`, and `address`.
- When sending `address`, **omit Mongo `_id`** from the address object (validation uses a whitelist of allowed address keys).

Command used (Node fetch + FormData; avoids curl JSON quoting issues):

```bash
node -e "(async()=>{const fs=require('fs'); const {Blob}=require('buffer'); const fd=new FormData(); fd.append('tradeName','Bakery And Grill Supply'); fd.append('legalName','Bakery And Grill Supply Lda'); fd.append('email','supplier-a@restaurantpos.test'); fd.append('phoneNumber','+351910000601'); fd.append('taxNumber','SUP-PT-0001'); fd.append('currentlyInUse','true'); const addr={country:'Portugal',state:'Lisbon',city:'Lisbon',street:'Avenida Fornecedores A',buildingNumber:'12',postCode:'1000-601',region:'Lisbon Metropolitan Area',additionalDetails:'Warehouse A',coordinates:[-9.1501,38.7361]}; fd.append('address',JSON.stringify(addr)); const buf=fs.readFileSync('C:/Users/jpdesouza/Documents/code/restaurant-pos/frontend/public/imperium.png'); fd.append('imageUrl', new Blob([buf],{type:'image/png'}), 'imperium.png'); const res=await fetch('http://localhost:4000/api/v1/suppliers/64b000000000000000000601',{method:'PATCH',body:fd}); console.log('STATUS',res.status); console.log(await res.text());})().catch(e=>{console.error(e); process.exit(1);});\""
```

#### Status after task 1.3
- ✅ Phase 1 / 1.3 completed
- ⏭️ Next: Phase 1 / 1.4 Purchase documents upload

### 1.4 Purchase documents upload (multi-file: images + docs)
- [x] Mandatory pre-step for this task: read this entire file (`cloudinary-full-test-todo.md`) before executing.
- [x] Pick one test purchaseId from dummy data (examples in `dummyData/purchases.json`):
  - `purchaseId=64b000000000000000000901` (Purchase Bun)
- [x] Identify/confirm the endpoint that supports multipart upload for purchase receipts and updates `Purchase.documentsUrl` (current status check):
  - `backend/src/routes/v1/purchases.ts` does *not* implement multipart/Cloudinary upload logic for `documentsUrl`
- [x] Send multipart request to update purchase documents:
  - Attempted (initial): `PATCH /api/v1/purchases/:purchaseId` with multipart form containing required JSON fields + file part.
  - Initial outcome: request failed with HTTP `500` (`route expects JSON body and doesn’t handle multipart`).
  - Retried (after code fix): `PATCH /api/v1/purchases/:purchaseId` with multipart form containing required fields + multiple file parts.
- [x] Confirm response:
  - Expected: success (`200`/`201`)
  - Actual (after code fix): HTTP `200` with `{"message":"Purchase updated successfully!"}`.
- [x] Fetch purchase and confirm:
  - `documentsUrl` updated from `[]` to an array of `2` Cloudinary URLs (image + raw doc).
- [x] Cloudinary verification:
  - Prefix checked: `restaurant-pos/business/<BUSINESS_ID>/purchases/<PURCHASE_ID>/`
  - Resource counts (Cloudinary `api.resources`):
    - `image`: `1`
    - `raw`: `1`

- Cloudinary prefix used (business/purchase folder):
  - `restaurant-pos/business/64b000000000000000000001/purchases/64b000000000000000000901/`

What we had to change (to make this pass):
- Implement multipart parsing in `backend/src/routes/v1/purchases.ts` for `PATCH /api/v1/purchases/:purchaseId`.
- Upload received multipart files to Cloudinary and set `Purchase.documentsUrl`.
- Allow multi-file uploads at the Fastify multipart plugin level in `backend/src/server.ts` (`limits.files` increased).

Commands used (retry after code fix):
```bash
node -e \"(async()=>{const fs=require('fs'); const {Blob}=require('buffer'); const fd=new FormData(); fd.append('title','Purchase Bun'); fd.append('purchaseDate','2026-03-20T09:00:00.000Z'); fd.append('businessId','64b000000000000000000001'); fd.append('purchasedByEmployeeId','64b000000000000000000201'); fd.append('receiptId','RCPT-0001'); const imgBuf=fs.readFileSync('C:/Users/jpdesouza/Documents/code/restaurant-pos/frontend/public/imperium.png'); fd.append('imageUrl', new Blob([imgBuf],{type:'image/png'}), 'imperium.png'); const docBuf=fs.readFileSync('C:/Users/jpdesouza/Documents/code/restaurant-pos/not-image.txt'); fd.append('documentsUrl', new Blob([docBuf],{type:'text/plain'}), 'not-image.txt'); const res=await fetch('http://localhost:4000/api/v1/purchases/64b000000000000000000901',{method:'PATCH',body:fd}); console.log('STATUS',res.status); console.log(await res.text());})().catch(e=>{console.error(e);process.exit(1);});\" 
```

#### Status after task 1.4
- ✅ Phase 1 / 1.4 completed

## Phase 2 - Replace + delete old file tests

### 2.1 Business image replacement
- [x] Mandatory pre-step for this task: read this entire file (`cloudinary-full-test-todo.md`) before executing.
- [x] Upload `test-image-1.jpg` to business.
- [x] Upload `test-image-2.jpg` to the same business.
- [x] Confirm second upload succeeds.
- [x] Confirm DB points to new URL.
- [x] Confirm old URL no longer appears in Cloudinary (deleted).

Note about filenames: the repo only contains `frontend/public/imperium.png` and `frontend/src/assets/hero.png` (no `test-image-*.jpg` files). I used those images but named them in the multipart payload as `test-image-1.jpg` and `test-image-2.jpg`.

Business used:
- `businessId=64b000000000000000000001`

Results:
- Initial DB `imageUrl` (to be replaced):
  - `https://res.cloudinary.com/jpsm83/image/upload/v1774426086/restaurant-pos/business/64b000000000000000000001/we5h1axwtqzqblwiiben.png`
- After upload #1 (`hero.png`, labeled `test-image-1.jpg`):
  - DB `imageUrl`:
    - `https://res.cloudinary.com/jpsm83/image/upload/v1774428968/restaurant-pos/business/64b000000000000000000001/hn3sbs8hhflqtvxp37ix.png`
- After upload #2 (`imperium.png`, labeled `test-image-2.jpg`):
  - DB `imageUrl`:
    - `https://res.cloudinary.com/jpsm83/image/upload/v1774428982/restaurant-pos/business/64b000000000000000000001/hb5ts6vg3koeozhb8n39.png`

Cloudinary deletion verification (using Cloudinary `api.resource(publicId)`):
- Old asset (`.../we5h1axwtqzqblwiiben`): **deleted (exists=false)**
- Intermediate asset (`.../hn3sbs8hhflqtvxp37ix`): **deleted (exists=false)**
- New asset (`.../hb5ts6vg3koeozhb8n39`): **present (exists=true)**

Commands used:
- Replacement upload #1 (hero):
  - `node -e` script that sends multipart `PATCH /api/v1/business/:businessId` with required business fields + `imageUrl` from `frontend/src/assets/hero.png`.
- Replacement upload #2 (imperium):
  - `node -e` script that sends multipart `PATCH /api/v1/business/:businessId` with required business fields + `imageUrl` from `frontend/public/imperium.png`.

#### Status after task 2.1
- ✅ Phase 2 / 2.1 completed
- ⏭️ Next: Phase 2 / 2.2

### 2.2 User image replacement
- [x] Mandatory pre-step for this task: read this entire file (`cloudinary-full-test-todo.md`) before executing.
- [x] Repeat replacement flow for user image (2-step replacement to ensure old asset deletion works twice).
- [x] Confirm old image is deleted after update.

Payload / user:
- `userId=64b000000000000000000101`
- Required multipart fields included:
  - `username`, `email`, `idType`, `idNumber`
  - `address` (JSON) WITHOUT Mongo `_id`
  - `firstName`, `lastName`, `nationality`, `gender`, `birthDate`, `phoneNumber`

Result:
- Initial user `personalDetails.imageUrl` public_id:
  - `restaurant-pos/users/64b000000000000000000101/darhxjyipx1njlzzepyk`
- After replacement #1 (`frontend/src/assets/hero.png`, labeled `test-image-1.jpg`):
  - New `personalDetails.imageUrl`:
    - `https://res.cloudinary.com/jpsm83/image/upload/v1774429945/restaurant-pos/users/64b000000000000000000101/m4bdalggl1idrmzsma0t.png`
  - Cloudinary verification:
    - old `darhx...` => deleted (`exists=false`)
    - new `m4bd...` => present (`exists=true`)
- After replacement #2 (`frontend/public/imperium.png`, labeled `test-image-2.jpg`):
  - New `personalDetails.imageUrl`:
    - `https://res.cloudinary.com/jpsm83/image/upload/v1774429970/restaurant-pos/users/64b000000000000000000101/z5xqefdgwtrnaij9eyq2.png`
  - Cloudinary verification:
    - intermediate `m4bd...` => deleted (`exists=false`)
    - new `z5xqefd...` => present (`exists=true`)

Commands used:
- Replacement #1:
  - Node `fetch` + `FormData` `PATCH /api/v1/users/64b000000000000000000101` with `imageUrl` from `frontend/src/assets/hero.png`
- Replacement #2:
  - Node `fetch` + `FormData` `PATCH /api/v1/users/64b000000000000000000101` with `imageUrl` from `frontend/public/imperium.png`

#### Status after task 2.2
- ✅ Phase 2 / 2.2 completed
- ⏭️ Next: Phase 3 / 3.1

## Phase 3 - Folder cleanup tests

### 3.1 Delete entity with Cloudinary folder
- [x] Mandatory pre-step for this task: read this entire file (`cloudinary-full-test-todo.md`) before executing.
- [x] Create or pick a safe test entity that has uploaded files.
- [x] Call delete route for that entity (business/user/supplier/etc.).
- [x] Confirm API delete succeeds.
- [x] Confirm related Cloudinary folder is removed or empty.

Test entity used:
- `businessId=64b000000000000000000001`
- `businessGoodId=64b000000000000000000501` (`Cheese Burger`)

What I did:
1. Uploaded an image to the businessGood via:
   - `PATCH /api/v1/businessGoods/:businessGoodId` (multipart `imageUrl`)
2. Deleted it via:
   - `DELETE /api/v1/businessGoods/:businessGoodId`

Cloudinary verification:
- Expected prefix:
  - `restaurant-pos/business/64b000000000000000000001/businessGoods/64b000000000000000000501/`
- Resources count:
  - before upload: `0`
  - after upload: `1`
  - after delete: `0` (empty)

#### Status after task 3.1
- ✅ Phase 3 / 3.1 completed
- ⏭️ Next: Phase 3 / 3.2

### 3.2 Double-check no orphan files
- [x] Mandatory pre-step for this task: read this entire file (`cloudinary-full-test-todo.md`) before executing.
- [x] Search Cloudinary for that entity folder prefix.
- [x] Confirm there are no leftover assets.

Cloudinary verification:
- Prefix checked:
  - `restaurant-pos/business/64b000000000000000000001/businessGoods/64b000000000000000000501/`
- API `resources({ type: 'upload', prefix })` result:
  - `count: 0`
  - `public_ids: []`

## Phase 4 - Negative tests (must fail correctly)

### 4.1 Non-image upload when only images are allowed
- [x] Mandatory pre-step for this task: read this entire file (`cloudinary-full-test-todo.md`) before executing.
- [x] Upload `not-image.txt` to endpoint that uses `onlyImages: true`:
  - `PATCH /api/v1/business/64b000000000000000000001`
- [x] Confirm request fails with `400`.
- [x] Confirm no file is created in Cloudinary (count unchanged).

Result:
- API response:
  - HTTP `400`
  - `{"message":"Error uploading image: Only images can be uploaded!"}`
- DB verification:
  - `business.imageUrl` unchanged
- Cloudinary verification:
  - Prefix checked: `restaurant-pos/business/64b000000000000000000001/`
  - Cloudinary upload resource count:
    - before: `6`
    - after:  `6`

### 4.2 Invalid entity id
- [x] Mandatory pre-step for this task: read this entire file (`cloudinary-full-test-todo.md`) before executing.
- [x] Send upload/update request with invalid ObjectId:
  - `PATCH /api/v1/business/invalid-id` (multipart `imageUrl` provided)
- [x] Confirm request fails with `400`.
- [x] Confirm no Cloudinary assets created under test business prefix:
  - Prefix: `restaurant-pos/business/64b000000000000000000001/`

Result:
- API response:
  - HTTP `400`
  - `{"message":"Invalid businessId!"}`
- Cloudinary verification:
  - resources count stayed the same: `6`

### 4.3 Missing required multipart/fields
- [x] Mandatory pre-step for this task: read this entire file (`cloudinary-full-test-todo.md`) before executing.
- [x] Send request without required fields:
  - `PATCH /api/v1/business/64b000000000000000000001` with multipart `imageUrl` only (no `tradeName`, `legalName`, `email`, `phoneNumber`, `taxNumber`, `subscription`, `currencyTrade`, `address`)
- [x] Confirm validation error response (`400`).
- [x] Confirm Cloudinary state unchanged:
  - Prefix: `restaurant-pos/business/64b000000000000000000001/`
  - Resource count: `6` (before) → `6` (after)

Result:
- API response:
  - HTTP `400`
  - `{"message":"TradeName, legalName, email, phoneNumber, taxNumber, subscription, currencyTrade and address are required!"}`

## Phase 5 - Final checklist

- [ ] Mandatory pre-step for this task: read this entire file (`cloudinary-full-test-todo.md`) before executing.
- [ ] Upload works for business and user endpoints.
- [ ] Upload works for purchase document endpoint (once multipart support exists).
- [ ] Replacement deletes old file correctly.
- [ ] Folder cleanup works after entity deletion.
- [ ] Invalid/non-image uploads fail with clear errors.
- [ ] DB URLs and Cloudinary assets remain consistent.
- [ ] Record final result in `backlogErrors.md`:
  - [ ] Passed scenarios
  - [ ] Failed scenarios
  - [ ] Route + payload used
  - [ ] Suggested fix (if any)

## Phase 6 - Move assets between folders (helper coverage)

Note: `backend/src/cloudinary/moveFilesBetweenFolders.ts` is currently not used by any route, but you want to keep it test-covered for when we start using it.

### 6.1 Move files between folders (rename/move)
- [ ] Mandatory pre-step for this task: read this entire file (`cloudinary-full-test-todo.md`) before executing.
- [ ] Pick an existing source prefix that already has uploaded assets (use one already-tested business/user/supplier folder from earlier phases).
- [ ] Choose a destination prefix (new folder path under the `restaurant-pos/` prefix).
- [ ] Call the helper directly:
  - `moveFilesBetweenFolders({ oldFolder, newFolder })`
  - IMPORTANT: provide `oldFolder` / `newFolder` **without a leading slash** so the helper doesn’t generate a double `//` in Cloudinary’s prefix.
- [ ] Verify the Cloudinary result:
  - The helper returns `secure_url` strings (expect `https://`)
  - The **old** public_ids no longer exist
  - The **new** public_ids exist under the destination prefix
- [ ] (Optional / future) If any DB fields store the moved public_id / URL, update them (the move helper alone does not update DB records).

#### Status after task 6.1
- [ ] Phase 6 / 6.1 not executed yet

## Simple command template (PowerShell + curl)

Use this format and adapt IDs/files:

```bash
curl.exe -X PATCH "http://localhost:4000/api/v1/business/<BUSINESS_ID>" ^
  -F "imageUrl=@C:/path/to/test-image-1.jpg;type=image/jpeg"
```

```bash
curl.exe "http://localhost:4000/api/v1/business/<BUSINESS_ID>"
```

Notes:
- Keep tests isolated to one business/user at a time.
- Prefer running one phase fully before moving to next.
