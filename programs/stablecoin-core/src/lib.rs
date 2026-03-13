use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, Burn, FreezeAccount, Mint, MintTo, ThawAccount, TokenAccount, TokenInterface,
    TransferChecked,
};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgMQVGKZ2H3m");

#[program]
pub mod stablecoin_core {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        params.validate()?;

        require_keys_eq!(
            ctx.accounts.master_authority.key(),
            params.master_authority,
            StablecoinError::InvalidMasterAuthority
        );
        require_eq!(
            ctx.accounts.mint.decimals,
            params.decimals,
            StablecoinError::InvalidMintDecimals
        );

        let config = &mut ctx.accounts.config;
        config.bump = ctx.bumps.config;
        config.mint = ctx.accounts.mint.key();
        config.name = params.name;
        config.symbol = params.symbol;
        config.uri = params.uri;
        config.decimals = params.decimals;
        config.enable_permanent_delegate = params.enable_permanent_delegate;
        config.enable_transfer_hook = params.enable_transfer_hook;
        config.default_account_frozen = params.default_account_frozen;
        config.paused = false;
        config.master_authority = params.master_authority;
        config.mint_authority = params.mint_authority;
        config.burner_authority = params.burner_authority;
        config.pauser_authority = params.pauser_authority;
        config.freeze_authority = params.freeze_authority;
        config.blacklister_authority = params.blacklister_authority;
        config.seizer_authority = params.seizer_authority;

        emit!(StablecoinInitialized {
            mint: config.mint,
            preset_compliance_enabled: config.compliance_enabled(),
        });

        Ok(())
    }

    pub fn update_roles(ctx: Context<UpdateRoles>, update: RoleUpdate) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.assert_master(ctx.accounts.master_authority.key())?;

        if let Some(value) = update.mint_authority {
            config.mint_authority = value;
        }
        if let Some(value) = update.burner_authority {
            config.burner_authority = value;
        }
        if let Some(value) = update.pauser_authority {
            config.pauser_authority = value;
        }
        if let Some(value) = update.freeze_authority {
            config.freeze_authority = value;
        }
        if let Some(value) = update.blacklister_authority {
            config.blacklister_authority = value;
        }
        if let Some(value) = update.seizer_authority {
            config.seizer_authority = value;
        }
        if let Some(value) = update.master_authority {
            config.master_authority = value;
        }

        Ok(())
    }

    pub fn transfer_authority(
        ctx: Context<TransferAuthority>,
        new_master_authority: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.assert_master(ctx.accounts.master_authority.key())?;
        config.master_authority = new_master_authority;

        emit!(MasterAuthorityTransferred {
            mint: config.mint,
            previous_master_authority: ctx.accounts.master_authority.key(),
            new_master_authority,
        });

        Ok(())
    }

    pub fn set_minter_quota(ctx: Context<SetMinterQuota>, max_allowance: u64) -> Result<()> {
        require!(max_allowance > 0, StablecoinError::InvalidAmount);

        let config = &ctx.accounts.config;
        config.assert_mint_admin(ctx.accounts.authority.key())?;

        let quota = &mut ctx.accounts.minter_quota;
        quota.bump = ctx.bumps.minter_quota;
        quota.config = config.key();
        quota.minter = ctx.accounts.minter.key();
        quota.max_allowance = max_allowance;
        if quota.minted_amount > max_allowance {
            quota.minted_amount = max_allowance;
        }

        Ok(())
    }

    pub fn update_minter(ctx: Context<SetMinterQuota>, max_allowance: u64) -> Result<()> {
        require!(max_allowance > 0, StablecoinError::InvalidAmount);

        let config = &ctx.accounts.config;
        config.assert_mint_admin(ctx.accounts.authority.key())?;

        let quota = &mut ctx.accounts.minter_quota;
        quota.bump = ctx.bumps.minter_quota;
        quota.config = config.key();
        quota.minter = ctx.accounts.minter.key();
        quota.max_allowance = max_allowance;
        if quota.minted_amount > max_allowance {
            quota.minted_amount = max_allowance;
        }

        Ok(())
    }

    pub fn remove_minter_quota(ctx: Context<RemoveMinterQuota>) -> Result<()> {
        let config = &ctx.accounts.config;
        config.assert_mint_admin(ctx.accounts.authority.key())?;
        Ok(())
    }

    pub fn mint(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        require!(amount > 0, StablecoinError::InvalidAmount);

        let config = &ctx.accounts.config;
        config.assert_not_paused()?;

        let quota = &mut ctx.accounts.minter_quota;
        require_keys_eq!(
            quota.config,
            config.key(),
            StablecoinError::InvalidQuotaAccount
        );
        require_keys_eq!(
            quota.minter,
            ctx.accounts.minter.key(),
            StablecoinError::UnauthorizedMinter
        );

        let next_minted = quota
            .minted_amount
            .checked_add(amount)
            .ok_or(StablecoinError::MathOverflow)?;
        require!(
            next_minted <= quota.max_allowance,
            StablecoinError::MinterQuotaExceeded
        );

        require_keys_eq!(
            ctx.accounts.destination.mint,
            ctx.accounts.mint.key(),
            StablecoinError::InvalidTokenMint
        );

        let config_mint = config.mint;
        let config_bump = [config.bump];
        let signer_seed_slice: &[&[u8]] = &[b"config", config_mint.as_ref(), &config_bump];
        let signer_seeds = &[signer_seed_slice];
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.destination.to_account_info(),
            authority: config.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );
        token_interface::mint_to(cpi_ctx, amount)?;

        quota.minted_amount = next_minted;

        emit!(Minted {
            mint: config.mint,
            minter: ctx.accounts.minter.key(),
            destination: ctx.accounts.destination.key(),
            amount,
        });

        Ok(())
    }

    pub fn burn(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        require!(amount > 0, StablecoinError::InvalidAmount);

        let config = &ctx.accounts.config;
        config.assert_not_paused()?;
        config.assert_burner(ctx.accounts.burner.key())?;

        require_keys_eq!(
            ctx.accounts.source.mint,
            ctx.accounts.mint.key(),
            StablecoinError::InvalidTokenMint
        );
        require_keys_eq!(
            ctx.accounts.source.owner,
            ctx.accounts.holder_authority.key(),
            StablecoinError::InvalidHolderAuthority
        );

        let cpi_accounts = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.source.to_account_info(),
            authority: ctx.accounts.holder_authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token_interface::burn(cpi_ctx, amount)?;

        emit!(Burned {
            mint: config.mint,
            burner: ctx.accounts.burner.key(),
            source: ctx.accounts.source.key(),
            amount,
        });

        Ok(())
    }

    pub fn freeze_account(ctx: Context<FreezeTokenAccount>) -> Result<()> {
        let config = &ctx.accounts.config;
        config.assert_freezer(ctx.accounts.freeze_authority.key())?;

        require_keys_eq!(
            ctx.accounts.token_account.mint,
            ctx.accounts.mint.key(),
            StablecoinError::InvalidTokenMint
        );

        let config_mint = config.mint;
        let config_bump = [config.bump];
        let signer_seed_slice: &[&[u8]] = &[b"config", config_mint.as_ref(), &config_bump];
        let signer_seeds = &[signer_seed_slice];
        let cpi_accounts = FreezeAccount {
            account: ctx.accounts.token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: config.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );
        token_interface::freeze_account(cpi_ctx)?;

        Ok(())
    }

    pub fn thaw_account(ctx: Context<ThawTokenAccount>) -> Result<()> {
        let config = &ctx.accounts.config;
        config.assert_freezer(ctx.accounts.freeze_authority.key())?;

        require_keys_eq!(
            ctx.accounts.token_account.mint,
            ctx.accounts.mint.key(),
            StablecoinError::InvalidTokenMint
        );

        let config_mint = config.mint;
        let config_bump = [config.bump];
        let signer_seed_slice: &[&[u8]] = &[b"config", config_mint.as_ref(), &config_bump];
        let signer_seeds = &[signer_seed_slice];
        let cpi_accounts = ThawAccount {
            account: ctx.accounts.token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: config.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );
        token_interface::thaw_account(cpi_ctx)?;

        Ok(())
    }

    pub fn pause(ctx: Context<TogglePause>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.assert_pauser(ctx.accounts.pauser.key())?;
        config.paused = true;
        Ok(())
    }

    pub fn unpause(ctx: Context<TogglePause>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.assert_pauser(ctx.accounts.pauser.key())?;
        config.paused = false;
        Ok(())
    }

    pub fn add_to_blacklist(ctx: Context<AddToBlacklist>, reason: String) -> Result<()> {
        validate_reason(&reason, BlacklistEntry::MAX_REASON_LEN)?;

        let config = &ctx.accounts.config;
        config.assert_compliance_enabled()?;
        config.assert_blacklister(ctx.accounts.blacklister.key())?;

        let entry = &mut ctx.accounts.blacklist_entry;
        entry.bump = ctx.bumps.blacklist_entry;
        entry.config = config.key();
        entry.wallet = ctx.accounts.wallet.key();
        entry.reason = reason;

        Ok(())
    }

    pub fn remove_from_blacklist(ctx: Context<RemoveFromBlacklist>) -> Result<()> {
        let config = &ctx.accounts.config;
        config.assert_compliance_enabled()?;
        config.assert_blacklister(ctx.accounts.blacklister.key())?;
        Ok(())
    }

    pub fn seize(ctx: Context<SeizeTokens>, amount: u64) -> Result<()> {
        require!(amount > 0, StablecoinError::InvalidAmount);

        let config = &ctx.accounts.config;
        config.assert_compliance_enabled()?;
        config.assert_seizer(ctx.accounts.seizer.key())?;

        require_keys_eq!(
            ctx.accounts.source.owner,
            ctx.accounts.blacklisted_owner.key(),
            StablecoinError::BlacklistOwnerMismatch
        );
        require_keys_eq!(
            ctx.accounts.source.mint,
            ctx.accounts.mint.key(),
            StablecoinError::InvalidTokenMint
        );
        require_keys_eq!(
            ctx.accounts.destination.mint,
            ctx.accounts.mint.key(),
            StablecoinError::InvalidTokenMint
        );
        require_keys_eq!(
            ctx.accounts.blacklist_entry.config,
            config.key(),
            StablecoinError::InvalidBlacklistAccount
        );
        require_keys_eq!(
            ctx.accounts.blacklist_entry.wallet,
            ctx.accounts.blacklisted_owner.key(),
            StablecoinError::BlacklistOwnerMismatch
        );

        let config_mint = config.mint;
        let config_bump = [config.bump];
        let signer_seed_slice: &[&[u8]] = &[b"config", config_mint.as_ref(), &config_bump];
        let signer_seeds = &[signer_seed_slice];
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.source.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.destination.to_account_info(),
            authority: config.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );
        token_interface::transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;

        emit!(Seized {
            mint: config.mint,
            blacklisted_owner: ctx.accounts.blacklisted_owner.key(),
            destination: ctx.accounts.destination.key(),
            amount,
        });

        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct InitializeParams {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
    pub enable_permanent_delegate: bool,
    pub enable_transfer_hook: bool,
    pub default_account_frozen: bool,
    pub master_authority: Pubkey,
    pub mint_authority: Pubkey,
    pub burner_authority: Pubkey,
    pub pauser_authority: Pubkey,
    pub freeze_authority: Pubkey,
    pub blacklister_authority: Pubkey,
    pub seizer_authority: Pubkey,
}

impl InitializeParams {
    fn validate(&self) -> Result<()> {
        require!(
            !self.name.is_empty() && self.name.len() <= StablecoinConfig::MAX_NAME_LEN,
            StablecoinError::NameTooLong
        );
        require!(
            !self.symbol.is_empty() && self.symbol.len() <= StablecoinConfig::MAX_SYMBOL_LEN,
            StablecoinError::SymbolTooLong
        );
        require!(
            self.uri.len() <= StablecoinConfig::MAX_URI_LEN,
            StablecoinError::UriTooLong
        );
        Ok(())
    }
}

fn validate_reason(reason: &str, max_len: usize) -> Result<()> {
    require!(
        !reason.is_empty() && reason.len() <= max_len,
        StablecoinError::ReasonTooLong
    );
    Ok(())
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Default)]
pub struct RoleUpdate {
    pub master_authority: Option<Pubkey>,
    pub mint_authority: Option<Pubkey>,
    pub burner_authority: Option<Pubkey>,
    pub pauser_authority: Option<Pubkey>,
    pub freeze_authority: Option<Pubkey>,
    pub blacklister_authority: Option<Pubkey>,
    pub seizer_authority: Option<Pubkey>,
}

#[account]
pub struct StablecoinConfig {
    pub bump: u8,
    pub mint: Pubkey,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
    pub enable_permanent_delegate: bool,
    pub enable_transfer_hook: bool,
    pub default_account_frozen: bool,
    pub paused: bool,
    pub master_authority: Pubkey,
    pub mint_authority: Pubkey,
    pub burner_authority: Pubkey,
    pub pauser_authority: Pubkey,
    pub freeze_authority: Pubkey,
    pub blacklister_authority: Pubkey,
    pub seizer_authority: Pubkey,
}

impl StablecoinConfig {
    pub const MAX_NAME_LEN: usize = 64;
    pub const MAX_SYMBOL_LEN: usize = 16;
    pub const MAX_URI_LEN: usize = 200;
    pub const INIT_SPACE: usize = 1
        + 32
        + (4 + Self::MAX_NAME_LEN)
        + (4 + Self::MAX_SYMBOL_LEN)
        + (4 + Self::MAX_URI_LEN)
        + 1
        + 1
        + 1
        + 1
        + 32 * 7;

    pub fn compliance_enabled(&self) -> bool {
        self.enable_permanent_delegate || self.enable_transfer_hook
    }

    pub fn assert_not_paused(&self) -> Result<()> {
        require!(!self.paused, StablecoinError::Paused);
        Ok(())
    }

    pub fn assert_master(&self, signer: Pubkey) -> Result<()> {
        require_keys_eq!(
            signer,
            self.master_authority,
            StablecoinError::UnauthorizedMaster
        );
        Ok(())
    }

    pub fn assert_mint_admin(&self, signer: Pubkey) -> Result<()> {
        require!(
            signer == self.master_authority || signer == self.mint_authority,
            StablecoinError::UnauthorizedMintAdmin
        );
        Ok(())
    }

    pub fn assert_burner(&self, signer: Pubkey) -> Result<()> {
        require!(
            signer == self.master_authority || signer == self.burner_authority,
            StablecoinError::UnauthorizedBurner
        );
        Ok(())
    }

    pub fn assert_pauser(&self, signer: Pubkey) -> Result<()> {
        require!(
            signer == self.master_authority || signer == self.pauser_authority,
            StablecoinError::UnauthorizedPauser
        );
        Ok(())
    }

    pub fn assert_freezer(&self, signer: Pubkey) -> Result<()> {
        require!(
            signer == self.master_authority || signer == self.freeze_authority,
            StablecoinError::UnauthorizedFreezer
        );
        Ok(())
    }

    pub fn assert_blacklister(&self, signer: Pubkey) -> Result<()> {
        require!(
            signer == self.master_authority || signer == self.blacklister_authority,
            StablecoinError::UnauthorizedBlacklister
        );
        Ok(())
    }

    pub fn assert_seizer(&self, signer: Pubkey) -> Result<()> {
        require!(
            signer == self.master_authority || signer == self.seizer_authority,
            StablecoinError::UnauthorizedSeizer
        );
        Ok(())
    }

    pub fn assert_compliance_enabled(&self) -> Result<()> {
        require!(
            self.compliance_enabled(),
            StablecoinError::ComplianceDisabled
        );
        Ok(())
    }
}

#[account]
pub struct MinterQuota {
    pub bump: u8,
    pub config: Pubkey,
    pub minter: Pubkey,
    pub max_allowance: u64,
    pub minted_amount: u64,
}

impl MinterQuota {
    pub const INIT_SPACE: usize = 1 + 32 + 32 + 8 + 8;
}

#[account]
pub struct BlacklistEntry {
    pub bump: u8,
    pub config: Pubkey,
    pub wallet: Pubkey,
    pub reason: String,
}

impl BlacklistEntry {
    pub const MAX_REASON_LEN: usize = 128;
    pub const INIT_SPACE: usize = 1 + 32 + 32 + (4 + Self::MAX_REASON_LEN);
}

#[derive(Accounts)]
#[instruction(params: InitializeParams)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub master_authority: Signer<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = payer,
        space = 8 + StablecoinConfig::INIT_SPACE,
        seeds = [b"config", mint.key().as_ref()],
        bump
    )]
    pub config: Account<'info, StablecoinConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateRoles<'info> {
    pub master_authority: Signer<'info>,
    #[account(mut, seeds = [b"config", config.mint.as_ref()], bump = config.bump)]
    pub config: Account<'info, StablecoinConfig>,
}

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    pub master_authority: Signer<'info>,
    #[account(mut, seeds = [b"config", config.mint.as_ref()], bump = config.bump)]
    pub config: Account<'info, StablecoinConfig>,
}

#[derive(Accounts)]
pub struct SetMinterQuota<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub authority: Signer<'info>,
    #[account(seeds = [b"config", config.mint.as_ref()], bump = config.bump)]
    pub config: Account<'info, StablecoinConfig>,
    /// CHECK: only the public key is used in PDA derivation.
    pub minter: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + MinterQuota::INIT_SPACE,
        seeds = [b"minter", config.key().as_ref(), minter.key().as_ref()],
        bump
    )]
    pub minter_quota: Account<'info, MinterQuota>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveMinterQuota<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [b"config", config.mint.as_ref()], bump = config.bump)]
    pub config: Account<'info, StablecoinConfig>,
    /// CHECK: receives reclaimed rent from the closed PDA.
    #[account(mut)]
    pub receiver: UncheckedAccount<'info>,
    #[account(
        mut,
        close = receiver,
        seeds = [b"minter", config.key().as_ref(), minter_quota.minter.as_ref()],
        bump = minter_quota.bump
    )]
    pub minter_quota: Account<'info, MinterQuota>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    pub minter: Signer<'info>,
    #[account(seeds = [b"config", config.mint.as_ref()], bump = config.bump)]
    pub config: Account<'info, StablecoinConfig>,
    #[account(mut, constraint = mint.key() == config.mint @ StablecoinError::InvalidTokenMint)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub destination: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"minter", config.key().as_ref(), minter.key().as_ref()],
        bump = minter_quota.bump
    )]
    pub minter_quota: Account<'info, MinterQuota>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    pub burner: Signer<'info>,
    pub holder_authority: Signer<'info>,
    #[account(seeds = [b"config", config.mint.as_ref()], bump = config.bump)]
    pub config: Account<'info, StablecoinConfig>,
    #[account(mut, constraint = mint.key() == config.mint @ StablecoinError::InvalidTokenMint)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub source: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct FreezeTokenAccount<'info> {
    pub freeze_authority: Signer<'info>,
    #[account(seeds = [b"config", config.mint.as_ref()], bump = config.bump)]
    pub config: Account<'info, StablecoinConfig>,
    #[account(mut, constraint = mint.key() == config.mint @ StablecoinError::InvalidTokenMint)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct ThawTokenAccount<'info> {
    pub freeze_authority: Signer<'info>,
    #[account(seeds = [b"config", config.mint.as_ref()], bump = config.bump)]
    pub config: Account<'info, StablecoinConfig>,
    #[account(mut, constraint = mint.key() == config.mint @ StablecoinError::InvalidTokenMint)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct TogglePause<'info> {
    pub pauser: Signer<'info>,
    #[account(mut, seeds = [b"config", config.mint.as_ref()], bump = config.bump)]
    pub config: Account<'info, StablecoinConfig>,
}

#[derive(Accounts)]
pub struct AddToBlacklist<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub blacklister: Signer<'info>,
    #[account(seeds = [b"config", config.mint.as_ref()], bump = config.bump)]
    pub config: Account<'info, StablecoinConfig>,
    /// CHECK: only the public key is used in PDA derivation.
    pub wallet: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + BlacklistEntry::INIT_SPACE,
        seeds = [b"blacklist", config.key().as_ref(), wallet.key().as_ref()],
        bump
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveFromBlacklist<'info> {
    pub blacklister: Signer<'info>,
    #[account(seeds = [b"config", config.mint.as_ref()], bump = config.bump)]
    pub config: Account<'info, StablecoinConfig>,
    /// CHECK: receives reclaimed rent from the closed PDA.
    #[account(mut)]
    pub receiver: UncheckedAccount<'info>,
    #[account(
        mut,
        close = receiver,
        seeds = [b"blacklist", config.key().as_ref(), blacklist_entry.wallet.as_ref()],
        bump = blacklist_entry.bump
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,
}

#[derive(Accounts)]
pub struct SeizeTokens<'info> {
    pub seizer: Signer<'info>,
    #[account(seeds = [b"config", config.mint.as_ref()], bump = config.bump)]
    pub config: Account<'info, StablecoinConfig>,
    #[account(mut, constraint = mint.key() == config.mint @ StablecoinError::InvalidTokenMint)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub source: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub destination: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: used for PDA validation against the blacklist entry and source owner.
    pub blacklisted_owner: UncheckedAccount<'info>,
    #[account(
        seeds = [b"blacklist", config.key().as_ref(), blacklisted_owner.key().as_ref()],
        bump = blacklist_entry.bump
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[event]
pub struct StablecoinInitialized {
    pub mint: Pubkey,
    pub preset_compliance_enabled: bool,
}

#[event]
pub struct Minted {
    pub mint: Pubkey,
    pub minter: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
}

#[event]
pub struct Burned {
    pub mint: Pubkey,
    pub burner: Pubkey,
    pub source: Pubkey,
    pub amount: u64,
}

#[event]
pub struct Seized {
    pub mint: Pubkey,
    pub blacklisted_owner: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
}

#[event]
pub struct MasterAuthorityTransferred {
    pub mint: Pubkey,
    pub previous_master_authority: Pubkey,
    pub new_master_authority: Pubkey,
}

#[error_code]
pub enum StablecoinError {
    #[msg("The provided master authority does not match the signer.")]
    InvalidMasterAuthority,
    #[msg("The provided mint decimals do not match the mint account.")]
    InvalidMintDecimals,
    #[msg("The stablecoin name exceeds the supported length.")]
    NameTooLong,
    #[msg("The stablecoin symbol exceeds the supported length.")]
    SymbolTooLong,
    #[msg("The stablecoin URI exceeds the supported length.")]
    UriTooLong,
    #[msg("The stablecoin is currently paused.")]
    Paused,
    #[msg("The amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Math overflow.")]
    MathOverflow,
    #[msg("The provided minter is not authorized.")]
    UnauthorizedMinter,
    #[msg("The provided minter quota account is invalid.")]
    InvalidQuotaAccount,
    #[msg("The mint quota has been exceeded.")]
    MinterQuotaExceeded,
    #[msg("Only the master authority may perform this action.")]
    UnauthorizedMaster,
    #[msg("Only the mint admin may manage minters.")]
    UnauthorizedMintAdmin,
    #[msg("Only the burner authority may perform this action.")]
    UnauthorizedBurner,
    #[msg("Only the pauser authority may perform this action.")]
    UnauthorizedPauser,
    #[msg("Only the freeze authority may perform this action.")]
    UnauthorizedFreezer,
    #[msg("Only the blacklister authority may perform this action.")]
    UnauthorizedBlacklister,
    #[msg("Only the seizer authority may perform this action.")]
    UnauthorizedSeizer,
    #[msg("The compliance module is disabled for this stablecoin.")]
    ComplianceDisabled,
    #[msg("The provided reason is invalid.")]
    ReasonTooLong,
    #[msg("The token account mint does not match the configured mint.")]
    InvalidTokenMint,
    #[msg("The provided holder authority does not own the source token account.")]
    InvalidHolderAuthority,
    #[msg("The provided blacklist account is invalid.")]
    InvalidBlacklistAccount,
    #[msg("The source account owner does not match the blacklisted wallet.")]
    BlacklistOwnerMismatch,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_config() -> StablecoinConfig {
        StablecoinConfig {
            bump: 1,
            mint: Pubkey::new_unique(),
            name: "Sample USD".to_string(),
            symbol: "sUSD".to_string(),
            uri: "https://example.com/metadata.json".to_string(),
            decimals: 6,
            enable_permanent_delegate: false,
            enable_transfer_hook: false,
            default_account_frozen: false,
            paused: false,
            master_authority: Pubkey::new_unique(),
            mint_authority: Pubkey::new_unique(),
            burner_authority: Pubkey::new_unique(),
            pauser_authority: Pubkey::new_unique(),
            freeze_authority: Pubkey::new_unique(),
            blacklister_authority: Pubkey::new_unique(),
            seizer_authority: Pubkey::new_unique(),
        }
    }

    #[test]
    fn initialize_params_reject_empty_name() {
        let params = InitializeParams {
            name: String::new(),
            symbol: "USD".to_string(),
            uri: String::new(),
            decimals: 6,
            enable_permanent_delegate: false,
            enable_transfer_hook: false,
            default_account_frozen: false,
            master_authority: Pubkey::new_unique(),
            mint_authority: Pubkey::new_unique(),
            burner_authority: Pubkey::new_unique(),
            pauser_authority: Pubkey::new_unique(),
            freeze_authority: Pubkey::new_unique(),
            blacklister_authority: Pubkey::new_unique(),
            seizer_authority: Pubkey::new_unique(),
        };

        assert!(params.validate().is_err());
    }

    #[test]
    fn compliance_flagging_requires_sss2_features() {
        let config = sample_config();
        assert!(!config.compliance_enabled());
        assert!(config.assert_compliance_enabled().is_err());
    }

    #[test]
    fn transfer_hook_or_delegate_enables_compliance_paths() {
        let mut config = sample_config();
        config.enable_transfer_hook = true;
        assert!(config.compliance_enabled());
        assert!(config.assert_compliance_enabled().is_ok());
    }

    #[test]
    fn pause_guard_blocks_mutating_paths() {
        let mut config = sample_config();
        config.paused = true;
        assert!(config.assert_not_paused().is_err());
    }

    #[test]
    fn role_checks_accept_expected_authorities() {
        let config = sample_config();
        assert!(config.assert_master(config.master_authority).is_ok());
        assert!(config.assert_mint_admin(config.mint_authority).is_ok());
        assert!(config.assert_burner(config.burner_authority).is_ok());
        assert!(config.assert_pauser(config.pauser_authority).is_ok());
        assert!(config.assert_freezer(config.freeze_authority).is_ok());
        assert!(config
            .assert_blacklister(config.blacklister_authority)
            .is_ok());
        assert!(config.assert_seizer(config.seizer_authority).is_ok());
    }

    #[test]
    fn role_checks_reject_unrelated_signer() {
        let config = sample_config();
        let outsider = Pubkey::new_unique();
        assert!(config.assert_master(outsider).is_err());
        assert!(config.assert_blacklister(outsider).is_err());
        assert!(config.assert_seizer(outsider).is_err());
    }

    #[test]
    fn blacklist_reason_must_be_present_and_bounded() {
        assert!(validate_reason("", BlacklistEntry::MAX_REASON_LEN).is_err());
        assert!(validate_reason("OFAC", BlacklistEntry::MAX_REASON_LEN).is_ok());
        let too_long = "x".repeat(BlacklistEntry::MAX_REASON_LEN + 1);
        assert!(validate_reason(&too_long, BlacklistEntry::MAX_REASON_LEN).is_err());
    }
}
