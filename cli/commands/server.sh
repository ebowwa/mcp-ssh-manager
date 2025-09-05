#!/bin/bash
# Server management commands for ssh-manager CLI

# Add a new server
cmd_server_add() {
    print_header "Add New SSH Server"
    
    # Get server name
    local server_name
    while true; do
        prompt_input "Server name (e.g., prod1, web-server)" "" "server_name"
        if validate_server_name "$server_name"; then
            break
        fi
    done
    
    # Get host
    local host
    prompt_input "Host/IP address" "" "host"
    
    # Get username
    local user
    prompt_input "Username" "root" "user"
    
    # Get port
    local port
    prompt_input "Port" "22" "port"
    
    # Get authentication type
    echo -e "\nAuthentication method:"
    echo "  1) SSH Key"
    echo "  2) Password"
    read -p "Choose [1-2]: " auth_choice
    
    local auth_type auth_value
    case "$auth_choice" in
        2)
            auth_type="password"
            prompt_password "Password" "auth_value"
            ;;
        *)
            auth_type="key"
            prompt_input "SSH key path" "$HOME/.ssh/id_rsa" "auth_value"
            # Expand ~ to home directory
            auth_value="${auth_value/#\~/$HOME}"
            ;;
    esac
    
    # Get optional description
    local description
    prompt_input "Description (optional)" "" "description"
    
    # Show summary
    echo
    print_subheader "Configuration Summary"
    print_table_row "Name:" "$server_name"
    print_table_row "Host:" "$host"
    print_table_row "User:" "$user"
    print_table_row "Port:" "$port"
    print_table_row "Auth:" "$auth_type"
    if [ "$auth_type" = "key" ]; then
        print_table_row "Key:" "$auth_value"
    fi
    if [ -n "$description" ]; then
        print_table_row "Description:" "$description"
    fi
    
    echo
    if prompt_yes_no "Save this configuration?" "y"; then
        add_server_to_env "$server_name" "$host" "$user" "$auth_type" "$auth_value" "$port" "$description"
        
        echo
        if prompt_yes_no "Test connection now?" "y"; then
            test_ssh_connection "$server_name"
        fi
    else
        print_info "Server configuration cancelled"
    fi
}

# List all servers
cmd_server_list() {
    print_header "SSH Servers"
    
    local servers=($(load_servers))
    
    if [ ${#servers[@]} -eq 0 ]; then
        print_warning "No servers configured"
        print_info "Use 'ssh-manager server add' to add a server"
        return 0
    fi
    
    print_table_header "NAME" "HOST" "USER"
    
    for server in "${servers[@]}"; do
        local host=$(get_server_config "$server" "HOST")
        local user=$(get_server_config "$server" "USER")
        local port=$(get_server_config "$server" "PORT")
        local description=$(get_server_config "$server" "DESCRIPTION")
        
        port=${port:-22}
        
        local host_info="$host:$port"
        if [ -n "$description" ]; then
            host_info="$host_info ($description)"
        fi
        
        print_table_row "$server" "$host_info" "$user"
    done
    
    echo
    print_info "Total servers: ${#servers[@]}"
}

# Test server connection
cmd_server_test() {
    local server="$1"
    
    if [ -z "$server" ]; then
        # Show menu if no server specified
        print_header "Test SSH Connection"
        
        local servers=($(load_servers))
        if [ ${#servers[@]} -eq 0 ]; then
            print_warning "No servers configured"
            return 1
        fi
        
        echo "Select a server to test:"
        local i=1
        for s in "${servers[@]}"; do
            echo "  $i) $s"
            ((i++))
        done
        
        read -p "Choose [1-${#servers[@]}]: " choice
        if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le ${#servers[@]} ]; then
            server="${servers[$((choice-1))]}"
        else
            print_error "Invalid choice"
            return 1
        fi
    fi
    
    test_ssh_connection "$server"
}

# Remove a server
cmd_server_remove() {
    local server="$1"
    
    if [ -z "$server" ]; then
        # Show menu if no server specified
        print_header "Remove SSH Server"
        
        local servers=($(load_servers))
        if [ ${#servers[@]} -eq 0 ]; then
            print_warning "No servers configured"
            return 1
        fi
        
        echo "Select a server to remove:"
        local i=1
        for s in "${servers[@]}"; do
            local host=$(get_server_config "$s" "HOST")
            echo "  $i) $s ($host)"
            ((i++))
        done
        
        read -p "Choose [1-${#servers[@]}]: " choice
        if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le ${#servers[@]} ]; then
            server="${servers[$((choice-1))]}"
        else
            print_error "Invalid choice"
            return 1
        fi
    fi
    
    local host=$(get_server_config "$server" "HOST")
    if [ -z "$host" ]; then
        print_error "Server '$server' not found"
        return 1
    fi
    
    echo
    print_warning "This will remove server '$server' ($host)"
    if prompt_yes_no "Are you sure?" "n"; then
        remove_server_from_env "$server"
    else
        print_info "Removal cancelled"
    fi
}

# Edit server configuration
cmd_server_edit() {
    local editor=$(get_config "default_editor" "${EDITOR:-nano}")
    
    if [ ! -f "$SSH_MANAGER_ENV" ]; then
        print_error "Configuration file not found: $SSH_MANAGER_ENV"
        return 1
    fi
    
    print_info "Opening configuration in $editor..."
    $editor "$SSH_MANAGER_ENV"
    
    print_success "Configuration updated"
}

# Show server details
cmd_server_show() {
    local server="$1"
    
    if [ -z "$server" ]; then
        print_error "Server name required"
        return 1
    fi
    
    local host=$(get_server_config "$server" "HOST")
    if [ -z "$host" ]; then
        print_error "Server '$server' not found"
        return 1
    fi
    
    print_header "Server Details: $server"
    
    print_table_row "Host:" "$host"
    print_table_row "User:" "$(get_server_config "$server" "USER")"
    print_table_row "Port:" "$(get_server_config "$server" "PORT")"
    
    local keypath=$(get_server_config "$server" "KEYPATH")
    local password=$(get_server_config "$server" "PASSWORD")
    
    if [ -n "$keypath" ]; then
        print_table_row "Auth Type:" "SSH Key"
        print_table_row "Key Path:" "$keypath"
    elif [ -n "$password" ]; then
        print_table_row "Auth Type:" "Password"
        print_table_row "Password:" "********"
    else
        print_table_row "Auth Type:" "Unknown"
    fi
    
    local description=$(get_server_config "$server" "DESCRIPTION")
    if [ -n "$description" ]; then
        print_table_row "Description:" "$description"
    fi
    
    local default_dir=$(get_server_config "$server" "DEFAULT_DIR")
    if [ -n "$default_dir" ]; then
        print_table_row "Default Dir:" "$default_dir"
    fi
}

# Main server command handler
cmd_server() {
    local subcommand="$1"
    shift
    
    case "$subcommand" in
        add)
            cmd_server_add "$@"
            ;;
        list|ls)
            cmd_server_list "$@"
            ;;
        test)
            cmd_server_test "$@"
            ;;
        remove|rm)
            cmd_server_remove "$@"
            ;;
        edit)
            cmd_server_edit "$@"
            ;;
        show|info)
            cmd_server_show "$@"
            ;;
        *)
            print_error "Unknown server command: $subcommand"
            echo "Available commands: add, list, test, remove, edit, show"
            return 1
            ;;
    esac
}