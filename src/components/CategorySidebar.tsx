// Sidebar for filtering components by category
// Reads from admin-managed categories table via listCategories query
import { navigate } from "../lib/router";

interface CategorySidebarProps {
  categories: Array<{
    category: string;
    label: string;
    description: string;
    count: number;
    verifiedCount: number;
    derived?: boolean;
  }>;
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  linkMode?: boolean;
}

// No trailing slash: www.convex.dev redirects /components/ to /components
const DIRECTORY_ROOT_HREF = "/components";

export function CategorySidebar({
  categories,
  selectedCategory,
  onSelectCategory,
  linkMode = false,
}: CategorySidebarProps) {
  // Derived categories overlap the others, so they are left out of the "All" total.
  const totalCount = categories.reduce(
    (sum, c) => (c.derived ? sum : sum + c.count),
    0,
  );

  const handleCategoryClick = (category: string | null) => {
    if (linkMode) {
      if (category === null) {
        navigate(DIRECTORY_ROOT_HREF);
      } else {
        navigate(`/components/categories/${category}`);
      }
    } else {
      onSelectCategory(category);
    }
  };

  return (
    <nav className="w-full">
      <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 px-2">
        Categories
      </h2>
      <ul className="space-y-0.5">
        <li>
          {linkMode ? (
            <a
              href={DIRECTORY_ROOT_HREF}
              className={`block w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                selectedCategory === null
                  ? "bg-text-primary text-white font-medium"
                  : "text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
              }`}
            >
              <span className="flex items-center justify-between">
                <span>All</span>
                <span className="text-xs opacity-60">{totalCount}</span>
              </span>
            </a>
          ) : (
            <button
              onClick={() => handleCategoryClick(null)}
              className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                selectedCategory === null
                  ? "bg-text-primary text-white font-medium"
                  : "text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
              }`}
            >
              <span className="flex items-center justify-between">
                <span>All</span>
                <span className="text-xs opacity-60">{totalCount}</span>
              </span>
            </button>
          )}
        </li>
        {categories.map((cat) => (
          <li key={cat.category}>
            {linkMode ? (
              <a
                href={`/components/categories/${cat.category}`}
                className={`block w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                  selectedCategory === cat.category
                    ? "bg-text-primary text-white font-medium"
                    : "text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                }`}
              >
                <span className="flex items-center justify-between">
                  <span>{cat.label}</span>
                  <span className="text-xs opacity-60">{cat.count}</span>
                </span>
              </a>
            ) : (
              <button
                onClick={() => handleCategoryClick(cat.category)}
                className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                  selectedCategory === cat.category
                    ? "bg-text-primary text-white font-medium"
                    : "text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                }`}
              >
                <span className="flex items-center justify-between">
                  <span>{cat.label}</span>
                  <span className="text-xs opacity-60">{cat.count}</span>
                </span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
