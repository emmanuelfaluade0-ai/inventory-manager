import { Link, useParams } from 'react-router-dom';
import { useProduct } from '../hooks/useProduct';
import RecordMovementForm from '../components/RecordMovementForm';

function formatTimestamp(value) {
  return new Date(value).toLocaleString();
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const { data: product, loading, error, refetch } = useProduct(id);

  // Only show the full-page loading state before we have anything to
  // display. A refetch after recording a movement also sets `loading`,
  // but the page should keep showing the current product (and the form
  // shouldn't remount) while that happens, not flash back to a blank
  // loading screen.
  if (loading && !product) {
    return (
      <div className="page">
        <Link to="/">&larr; Back to products</Link>
        <p className="status">Loading product…</p>
      </div>
    );
  }

  if (error && error.status === 404) {
    return (
      <div className="page">
        <Link to="/">&larr; Back to products</Link>
        <p className="status">Product not found.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <Link to="/">&larr; Back to products</Link>
        <div className="status status-error">
          <p>Couldn't load this product. Is the API running?</p>
          <button type="button" onClick={refetch}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isLow = product.stock <= product.reorderThreshold;

  return (
    <div className="page">
      <Link to="/">&larr; Back to products</Link>

      <div className="product-info">
        <h1>{product.name}</h1>
        <dl>
          <div>
            <dt>SKU</dt>
            <dd>{product.sku}</dd>
          </div>
          <div>
            <dt>Stock</dt>
            <dd className={isLow ? 'low-stock-value' : undefined}>{product.stock}</dd>
          </div>
          <div>
            <dt>Reorder threshold</dt>
            <dd>{product.reorderThreshold}</dd>
          </div>
        </dl>
      </div>

      <RecordMovementForm productId={product.id} onRecorded={refetch} />

      <h2>Movement history</h2>
      {product.movements.length === 0 ? (
        <p className="status">No movements yet.</p>
      ) : (
        <table className="product-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Quantity</th>
              <th>Note</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {product.movements.map((movement) => (
              <tr key={movement.id}>
                <td>{movement.type}</td>
                <td>{movement.quantity}</td>
                <td>{movement.note ?? ''}</td>
                <td>{formatTimestamp(movement.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
