[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$OutputPath
)

Set-StrictMode -Version 3
$ErrorActionPreference = 'Stop'

function Unavailable([string]$code, [string]$reason) {
  return [pscustomobject]@{ status = 'unavailable'; reasonCode = $code; reason = $reason }
}

function Read-Firewall {
  try {
    $raw = @(Get-NetFirewallProfile -ErrorAction Stop)
    if ($raw.Count -eq 0) { throw 'FIREWALL_EMPTY' }
    $profiles = @($raw | ForEach-Object {
        [pscustomobject]@{
          name = [string]$_.Name
          enabled = [bool]$_.Enabled
          defaultInboundAction = [string]$_.DefaultInboundAction
          defaultOutboundAction = [string]$_.DefaultOutboundAction
        }
      })
    $enabled = @($profiles | Where-Object { $_.enabled }).Count
    $summary = if ($enabled -eq $profiles.Count) { 'enabled' } elseif ($enabled -eq 0) { 'disabled' } else { 'mixed' }
    return [pscustomobject]@{ status = 'measured'; summary = $summary; profiles = $profiles }
  } catch {
    try {
      $registryProfiles = @(
        [pscustomobject]@{ name = 'Domain'; path = 'HKLM:\SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\DomainProfile' }
        [pscustomobject]@{ name = 'Standard'; path = 'HKLM:\SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\StandardProfile' }
        [pscustomobject]@{ name = 'Public'; path = 'HKLM:\SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\PublicProfile' }
      )
      $profiles = @()
      foreach ($entry in $registryProfiles) {
        $item = Get-ItemProperty -LiteralPath $entry.path -ErrorAction Stop
        if ($item.PSObject.Properties.Name -notcontains 'EnableFirewall') { throw 'FIREWALL_REGISTRY_VALUE_MISSING' }
        $profiles += [pscustomobject]@{
          name = $entry.name
          enabled = ([int]$item.EnableFirewall -eq 1)
          defaultInboundAction = 'unknown'
          defaultOutboundAction = 'unknown'
        }
      }
      $enabled = @($profiles | Where-Object { $_.enabled }).Count
      $summary = if ($enabled -eq $profiles.Count) { 'enabled' } elseif ($enabled -eq 0) { 'disabled' } else { 'mixed' }
      return [pscustomobject]@{ status = 'measured'; summary = $summary; profiles = $profiles; source = 'registry-read-only' }
    } catch {
      return Unavailable 'FIREWALL_ACCESS_UNAVAILABLE' '일반 권한에서 방화벽 프로필을 읽지 못했습니다. 설정은 변경하지 않았습니다.'
    }
  }
}

function Read-EventLog([string]$Name) {
  try {
    Get-WinEvent -ListLog $Name -ErrorAction Stop | Out-Null
    $items = @(Get-WinEvent -FilterHashtable @{ LogName = $Name; StartTime = (Get-Date).AddHours(-24); Level = 2, 3 } -ErrorAction SilentlyContinue)
    $errors = @($items | Where-Object { $_.Level -eq 2 }).Count
    $warnings = @($items | Where-Object { $_.Level -eq 3 }).Count
    return [pscustomobject]@{ status = 'measured'; logName = $Name; errorCount = $errors; warningCount = $warnings; totalCount = ($errors + $warnings); windowHours = 24 }
  } catch {
    return Unavailable 'EVENT_LOG_ACCESS_UNAVAILABLE' ($Name + ' Windows 기록을 읽지 못했습니다.')
  }
}

$directory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$snapshot = [pscustomobject]@{
  schema = 'keshev.local-observation.v1'
  observedAt = (Get-Date).ToUniversalTime().ToString('o')
  source = 'windows-read-only'
  firewall = Read-Firewall
  events = @((Read-EventLog 'System'), (Read-EventLog 'Application'))
}
$temporary = $OutputPath + '.tmp'
$snapshot | ConvertTo-Json -Compress -Depth 8 | Set-Content -LiteralPath $temporary -Encoding UTF8
Move-Item -LiteralPath $temporary -Destination $OutputPath -Force
