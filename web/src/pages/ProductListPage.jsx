import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import AddProductForm from '../components/AddProductForm';

export default function ProductListPage() {
  const [searchInput, setSearchInput] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const search = useDebouncedValue(searchInput, 300);

  const { data: products, loading, error, refetch } = useProducts({ search, lowStock: lowStockOnly });

  const hasFilters = search.trim() !== '' || lowStockOnly;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Products</h1>
        <button type="button" onClick={() => setShowAddForm(true)}>
          Add product
        </button>
      </div>

      <div className="controls">
        <input
          type="search"
          placeholder="Search by name or SKU"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Search products"
        />
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
          />
          Low stock only
        </label>
      </div>

      {loading && <p className="status">Loading products…</p>}

      {!loading && error && (
        <div className="status status-error">
          <p>Couldn't load products. Is the API running?</p>
          <button type="button" onClick={refetch}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && products && products.length === 0 && (
        <p className="status">
          {hasFilters
            ? 'No products match your search or filter.'
            : 'No products yet — add one to get started.'}
        </p>
      )}

      {!loading && !error && products && products.length > 0 && (
        <table className="product-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Stock</th>
              <th>Reorder threshold</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const isLow = product.stock <= product.reorderThreshold;
              return (
                <tr key={product.id} className={isLow ? 'row-low-stock' : undefined}>
                  <td>
                    <Link to={`/products/${product.id}`}>{product.sku}</Link>
                  </td>
                  <td>{product.name}</td>
                  <td>{product.stock}</td>
                  <td>{product.reorderThreshold}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {showAddForm && (
        <AddProductForm
          onClose={() => setShowAddForm(false)}
          onCreated={() => {
            setShowAddForm(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
