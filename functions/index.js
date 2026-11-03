const { getApps, initializeApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { HttpsError, onCall } = require('firebase-functions/v2/https');

const DATABASE_ID = 'ai-studio-b778b7a0-094e-4dd1-9b4e-402961cd1bcf';
const REGION = 'us-central1';
const app = getApps().length ? getApps()[0] : initializeApp();
const db = getFirestore(app, DATABASE_ID);

function getPublicCatalogProduct(data) {
  const isDeleted = data.isDeleted === true;
  const stock = Number(data.cantidad ?? data.stock ?? 0);
  const description = data.publicDescription ?? data.descripcionPublica;
  const product = {
    nombre: data.nombre ?? data.name ?? '',
    marca: data.marca ?? data.brand ?? '',
    categoria: data.category ?? data.categoria ?? 'Vapes',
    precio: Number(data.precio ?? data.sellingPrice ?? 0),
    disponible: !isDeleted && stock > 0,
    inventorySource: true,
    inventoryDeleted: isDeleted,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
    descripcion: typeof description === 'string' && description.trim()
      ? description.trim()
      : FieldValue.delete(),
    imagenUrl: typeof (data.imagenUrl ?? data.imageUrl ?? data.image) === 'string' &&
      (data.imagenUrl ?? data.imageUrl ?? data.image).trim()
      ? data.imagenUrl ?? data.imageUrl ?? data.image
      : FieldValue.delete(),
    variantes: Array.isArray(data.variantes ?? data.variants ?? data.flavors)
      ? (data.variantes ?? data.variants ?? data.flavors)
        .filter((variant) => typeof variant === 'string')
      : FieldValue.delete()
  };

  return product;
}

async function writeInBatches(writes) {
  for (let offset = 0; offset < writes.length; offset += 450) {
    const batch = db.batch();
    for (const write of writes.slice(offset, offset + 450)) {
      if (write.type === 'delete') {
        batch.delete(write.ref);
      } else {
        batch.set(write.ref, write.data, { merge: true });
      }
    }
    await batch.commit();
  }
}

async function reconcileCatalog() {
  const [productsSnapshot, catalogSnapshot] = await Promise.all([
    db.collection('productos').get(),
    db.collection('catalogo_publico').get()
  ]);
  const productIds = new Set(productsSnapshot.docs.map((product) => product.id));
  const writes = productsSnapshot.docs.map((product) => ({
    type: 'set',
    ref: db.collection('catalogo_publico').doc(product.id),
    data: getPublicCatalogProduct(product.data())
  }));
  let removed = 0;

  for (const catalogProduct of catalogSnapshot.docs) {
    if (!productIds.has(catalogProduct.id) && catalogProduct.get('inventorySource') === true) {
      writes.push({ type: 'delete', ref: catalogProduct.ref });
      removed += 1;
    }
  }

  await writeInBatches(writes);
  return { synced: productsSnapshot.size, removed };
}

async function isAuthorizedAdmin(user) {
  if (user.uid === '7veWlG9BEWgorpmf7sMAPJvMY3k2' ||
      user.email === 'djgamer802@gmail.com' ||
      user.email === 'supposimon@gmail.com') {
    return true;
  }

  if (!user.email) {
    return false;
  }

  const config = await db.collection('admin_config').doc('emails').get();
  const emails = config.get('list');
  return Array.isArray(emails) && emails.includes(user.email);
}

exports.syncPublicCatalogProduct = onDocumentWritten(
  {
    document: 'productos/{productId}',
    database: DATABASE_ID,
    region: REGION
  },
  async (event) => {
    const productRef = db.collection('catalogo_publico').doc(event.params.productId);
    const product = event.data?.after;

    if (!product?.exists) {
      const catalogProduct = await productRef.get();
      if (catalogProduct.get('inventorySource') === true) {
        await productRef.delete();
      }
      return;
    }

    await productRef.set(getPublicCatalogProduct(product.data()), { merge: true });
  }
);

exports.reconcilePublicCatalog = onCall(
  { region: REGION, timeoutSeconds: 540 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión para sincronizar el catálogo.');
    }

    if (!(await isAuthorizedAdmin(request.auth))) {
      throw new HttpsError('permission-denied', 'No tienes permisos para sincronizar el catálogo.');
    }

    return reconcileCatalog();
  }
);
