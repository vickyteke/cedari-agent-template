# Extension points

## AI providers

apps/backend/src/lib/providers/current.ts implements ConversationProvider.respond(payload, signal) and ImageProvider.edit(form, signal) using the existing provider. Model names live in agent configuration, with OPENAI_MODEL as an optional server override. Add another provider module implementing the same boundaries and adapt its output to the validated response stream contract. The first release does not ship provider routing.

Keep authentication, quotas, variant verification, category/merchant restrictions and checkout validation outside the provider. Persona and tone settings must not weaken those checks. Providers receive only the context required for the current turn. Never log credentials or raw customer prompts.

## Photo workflows

Enable uploads and list workflows in agent.photoWorkflows. complementary uses visible attributes to recommend matching products, similar searches for visually related products without claiming exact identification, and room-preview supports the existing wall-decor/rug pilot with placement confirmation. The pilot does not render arbitrary product categories. A preview also requires features.roomPreviews, ROOM_PREVIEW_ENABLED, provider credentials and private storage. Configure IMAGE_REFERENCE_HOSTS to exact trusted public merchant CDN hosts. Redirects and oversized downloads are refused.

The registry in apps/backend/src/lib/photo-workflows/registry.ts accepts custom server-side handlers with an ID, intent guidance, feature requirements a matches(text) predicate, inputSchema, outputSchema and a run function. Add handlers to config/photo-workflows.ts and enable their IDs in config/agent.ts. Each handler must use validated inputs and declare its enabled capabilities. Ambiguous built-in intent asks the customer which supported behavior they want.

Custom outputs are validated and product IDs are refreshed through the scoped Cedari adapter before display. A handler does not get permission to bypass customer ownership, spend limits or commerce policy. Existing room preview flows sign the selected product/photo/placement state and cap paid image operations. For custom paid operations use the same admission and budget functions explicitly.

## UI and languages

Use config first for branding, layout values, tabs, slides and preferences. Larger screen compositions and custom tabs are React components. Extend the tab registry and route guards together. Future language packs supply dictionaries with the existing keys and matching interpolation parameters. Permission prompts and email copy are part of localization as well as app screens.
