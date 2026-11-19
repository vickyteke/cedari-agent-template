# Cedari contract

Sign up at [cedari.ai](https://cedari.ai) and create an API key for Cedari MCP access. Configure `CEDARI_MCP_URL` and `CEDARI_API_KEY` in your backend environment. Never embed the API key in the mobile app or commit it to Git.

The adapter uses MCP initialize, tools/list and tools/call. Required tools are search_products and get_products, plus create_checkout when checkout is enabled. Protocol metadata is cached per credential and endpoint, never customer content.

The inspected Cedari contract exposes categories as canonical string keys, not separate category UUIDs. Search accepts categories (1–100 strings) and merchant_ids (1–50 stable IDs). A singular category intersects with categories. Template allowlists require an operator-reviewed registry in config/agent.ts because the available MCP tools do not expose authoritative merchant/category enumeration. Use exact category keys from your Cedari integration and stable merchant IDs, not display names.

Evidence comes from the existing adapter and read-only inspection of Cedari packages/commerce-contracts/src/schemas.ts and packages/commerce-mcp/src/mcp.ts. No Cedari code was changed. Confirm your deployed server matches this contract with npm run doctor and tools/list before launch. Local fixtures prove the adapter, not availability of a live merchant's checkout.
