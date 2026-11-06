# Contracts — ULBS-Proiect

<!-- graffino-agentic:begin v1 -->
> Promises across a boundary. **Provided:** this repo owns the contract; the text
> lives here only. **Consumed:** a link to the provider's entry plus the fields this
> repo relies on. **External:** what we rely on from a third-party service.
> Changing a provided contract is a PROPOSAL (AGENTS.md → The gate) and the plan
> lists the consumers' files too. Status: `approved` · `proposed` · `superseded-by`.
<!-- graffino-agentic:end -->

## Index
- C-001 · Server container interface · provided · _proposed_

---

## Provided

### C-001 · Server container interface
- **Status:** proposed
- **Interface:** Docker / Docker Compose container definitions and port mappings
- **Consumers:** Local development environment and host services
- **Shape:** Exposed container ports, health check endpoints, environment variables
- **Rules:** Must run inside Docker container per D-001
- **Evidence:** docs/agents/DECISIONS.md
- **Source:** user · confidence high

## Consumed

## External
