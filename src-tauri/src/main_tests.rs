#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;
    use std::str::FromStr;
    use tauri::utils::acl::{capability::CapabilityFile, manifest::Manifest, resolved::Resolved};
    use tauri::utils::platform::Target;

    #[test]
    fn mcp_commands_allowed_for_dev_origin() {
        let capability_file = CapabilityFile::from_str(include_str!("../capabilities/main.json"))
            .expect("parse capability file");
        let capabilities = match capability_file {
            CapabilityFile::Capability(capability) => vec![capability],
            CapabilityFile::List(list) | CapabilityFile::NamedList { capabilities: list } => list,
        };
        let mut capability_map = BTreeMap::new();
        for capability in capabilities {
            capability_map.insert(capability.identifier.clone(), capability);
        }

        let manifests: BTreeMap<String, Manifest> =
            serde_json::from_str(include_str!("../gen/schemas/acl-manifests.json"))
                .expect("parse ACL manifests");

        let resolved =
            Resolved::resolve(&manifests, capability_map, Target::current()).expect("resolve ACL");

        let commands = resolved
            .allowed_commands
            .get("mcp_load_servers")
            .expect("mcp_load_servers command should be allowed");

        assert!(format!("{:?}", commands).contains("Remote"));
    }
}
