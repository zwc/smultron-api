import { notifySlackOnError } from './src/utils/slack';

function wrap(handler: any, name: string) {
	return async (event: any, context: any) => {
		try {
			return await handler(event, context);
		} catch (err) {
			// Await notify so logs from the notifier appear in CloudWatch for debugging
			try {
				// eslint-disable-next-line no-console
				console.log(`Attempting to notify Slack for ${name}`);
				await notifySlackOnError(name, err);
			} catch (notifyErr) {
				// eslint-disable-next-line no-console
				console.error('Slack notify failed', notifyErr);
			}
			console.error(`Unhandled error in ${name}:`, err);
			// Return a generic 500 response to API Gateway
			return {
				statusCode: 500,
				body: JSON.stringify({ error: 'Internal server error' }),
				headers: { 'Content-Type': 'application/json' },
			};
		}
	};
}

export { handler as rawLogin } from './src/handlers/login';
export const login = wrap(require('./src/handlers/login').handler, 'login');
export const listCatalog = wrap(require('./src/handlers/list.catalog').handler, 'listCatalog');
export const listProducts = wrap(require('./src/handlers/list.products').handler, 'listProducts');
export const getProduct = wrap(require('./src/handlers/get.product').handler, 'getProduct');
export const createProduct = wrap(require('./src/handlers/create.product').handler, 'createProduct');
export const updateProduct = wrap(require('./src/handlers/update.product').handler, 'updateProduct');
export const deleteProduct = wrap(require('./src/handlers/delete.product').handler, 'deleteProduct');
export const listCategories = wrap(require('./src/handlers/admin.list.categories').handler, 'listCategories');
export const getCategory = wrap(require('./src/handlers/get.category').handler, 'getCategory');
export const createCategory = wrap(require('./src/handlers/create.category').handler, 'createCategory');
export const updateCategory = wrap(require('./src/handlers/update.category').handler, 'updateCategory');
export const deleteCategory = wrap(require('./src/handlers/delete.category').handler, 'deleteCategory');
export const createOrder = wrap(require('./src/handlers/create.order').handler, 'createOrder');
export const checkout = wrap(require('./src/handlers/checkout').handler, 'checkout');
export const swishCallback = wrap(require('./src/handlers/swish.callback').handler, 'swishCallback');
export const listOrders = wrap(require('./src/handlers/list.orders').handler, 'listOrders');
export const getOrder = wrap(require('./src/handlers/get.order').handler, 'getOrder');
export const updateOrderStatus = wrap(require('./src/handlers/update.order.status').handler, 'updateOrderStatus');
export const adminListProducts = wrap(require('./src/handlers/admin.list.products').handler, 'adminListProducts');
export const adminUpdateProductIndexes = wrap(require('./src/handlers/admin.update.product.indexes').handler, 'adminUpdateProductIndexes');
export const adminUpdateCategoryIndexes = wrap(require('./src/handlers/admin.update.category.indexes').handler, 'adminUpdateCategoryIndexes');
export const pingError = wrap(require('./src/handlers/ping.error').handler, 'pingError');