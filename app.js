const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const STORE_DOMAIN = process.env.STORE_DOMAIN;
const STORE_FRONT_TOKEN = process.env.STORE_FRONT_TOKEN;

const args = process.argv.slice(2);

let productName = parseProductName(args);
const useStoreFrontToken = args.includes("--use-storefront");

(async function () {
  const products = useStoreFrontToken
    ? await fetchProductsWithStorefrontToken(productName)
    : await fetchProductsWithAdminToken(productName);

  if (products.length > 0) {
    displaySortedProductVariants(products);
  } else {
    console.log("No products found.");
  }
})();

function parseProductName(args) {
  return args
    .filter((arg) => !arg.startsWith("-"))
    .join(" ")
    .trim();
}

async function sendGraphQLRequest(query, variables, headers, endpoint) {
  try {
    const response = await axios.post(
      endpoint,
      { query, variables },
      { headers }
    );
    return response.data;
  } catch (error) {
    console.error(
      "Error during GraphQL request:",
      error.response?.data || error.message
    );
    throw error;
  }
}

async function fetchProductsWithStorefrontToken(productName) {
  const query = `
    query predictiveSearch($query: String!) {
      predictiveSearch(query: $query, limit: 10) {
        products {
          id
          title
          variants(first: 10) {
            edges {
              node {
                id
                title
                price {
                  amount
                }
              }
            }
          }
        }
      }
    }
  `;

  const variables = { query: `title:${productName.trim()}` };
  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Storefront-Access-Token": STORE_FRONT_TOKEN,
  };
  const endpoint = `https://${STORE_DOMAIN}/api/2024-07/graphql.json`;

  const data = await sendGraphQLRequest(query, variables, headers, endpoint);
  return data?.data?.predictiveSearch?.products || [];
}

async function fetchProductsWithAdminToken(productName) {
  const query = `
    query Products($query: String!) {
      products(first: 10, query: $query) {
        edges {
          node {
            title
            variants(first: 10) {
              edges {
                node {
                  title
                  price
                }
              }
            }
          }
        }
      }
    }
  `;

  const variables = { query: `title:${productName.trim()}` };
  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": ADMIN_TOKEN,
  };
  const endpoint = `https://${STORE_DOMAIN}/admin/api/2024-07/graphql.json`;

  const data = await sendGraphQLRequest(query, variables, headers, endpoint);
  return data?.data?.products?.edges || [];
}

function displaySortedProductVariants(products) {
  const variants = products.flatMap((product) => {
    return product.node.variants.edges.map((variant) => ({
      productName: product.title || product.node.title,
      variantName: variant.node.title,
      price: parseFloat(variant.node.price.amount || variant.node.price),
    }));
  });

  variants
    .sort((a, b) => a.price - b.price)
    .forEach((variant) => {
      console.log(
        `${variant.productName} - ${variant.variantName} - price $${variant.price}`
      );
    });
}
