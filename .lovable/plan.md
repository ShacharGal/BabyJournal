

## Plan: Add date of birth + rename "baby" to "child"

### 1. Database migration
Add a `date_of_birth` column (type `date`, nullable) to the `babies` table.

### 2. Update `AddBabyForm` (rename to `AddChildForm`)
- Rename file to `src/components/AddChildForm.tsx`
- Add a date-of-birth date input field alongside the name field
- Change all copy from "baby" to "child" ("Add a Child", "Create a profile for your little one", etc.)
- Pass `date_of_birth` into the create mutation

### 3. Update `BabyList` (rename to `ChildList`)
- Rename file to `src/components/ChildList.tsx`
- Change heading to "Your Children"
- Show date of birth and current age next to each child's name (e.g. "Born Jan 5, 2023 - 2 years old")

### 4. Update `EntryList` - show child's age at time of memory
- In each `EntryCard`, compute the child's age at the memory date using the child's `date_of_birth` from the babies query
- Display it as a small label like "3 months old" or "1 year, 2 months old" next to the date

### 5. Update `UploadEntryForm`
- Change label from "Baby" to "Child" in the select dropdown

### 6. Update `Index.tsx` and other references
- Import renamed components (`AddChildForm`, `ChildList`)
- Update any remaining "baby" text in headings/descriptions across the page

### 7. Terminology cleanup
- `BabyList` → `ChildList`, `AddBabyForm` → `AddChildForm` in file names and component names
- All user-facing strings: "baby" → "child", "babies" → "children"
- Keep database table name `babies` and hook names unchanged to avoid unnecessary churn

### Technical: Age calculation
Use `date-fns`'s `differenceInMonths` and `differenceInYears` to compute age. Display format:
- < 1 month: "X days old"
- < 24 months: "X months old"  
- >= 24 months: "X years, Y months old"

