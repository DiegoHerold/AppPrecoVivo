'use client'

import { useEffect, useState } from 'react'
import { clientApi } from '@/lib/client-api'
import type { AccountPlanCategoryDto, AppScreen, CategoryDto, DashboardDto, ProductDetailDto, ProductDto, PurchaseDto, ReviewDto, UserDto } from '@/lib/client-types'
import { AuthScreen } from './auth-screen'
import { AddNoteScreen } from './add-note-screen'
import { BottomNav, ErrorState, LoadingState } from './ui'
import { HomeScreen } from './home-screen'
import { FlowScreen } from './flow-screen'
import { ProductsScreen } from './products-screen'
import { CategoriesScreen } from './categories-screen'
import { ProductDetailScreen } from './product-detail-screen'
import { ManualPurchaseScreen } from './manual-purchase-screen'
import { TextPurchaseScreen } from './text-purchase-screen'
import { ProcessingScreen } from './processing-screen'
import { SummaryScreen } from './summary-screen'
import { ReviewsScreen } from './reviews-screen'
import { ProfileScreen } from './profile-screen'

const withoutBottomNav = new Set<AppScreen>(['add', 'manual', 'text', 'processing'])

async function fetchAppData(period: { year: number; month: number }) {
  const query = `?year=${period.year}&month=${period.month}`
  const [dashboard, accountPlan, products, reviews] = await Promise.all([
    clientApi<DashboardDto>(`/api/dashboard${query}`),
    clientApi<AccountPlanCategoryDto[]>('/api/account-plan'),
    clientApi<ProductDto[]>('/api/products'),
    clientApi<ReviewDto[]>('/api/reviews'),
  ])
  return { dashboard, categories: dashboard.categories, accountPlan, products, reviews }
}

export function PurchaseFlowApp() {
  const now = new Date()
  const [user, setUser] = useState<UserDto | null>(null)
  const [checking, setChecking] = useState(true)
  const [screen, setScreen] = useState<AppScreen>('home')
  const [, setHistory] = useState<AppScreen[]>(['home'])
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [dashboard, setDashboard] = useState<DashboardDto | null>(null)
  const [categories, setCategories] = useState<CategoryDto[]>([])
  const [accountPlan, setAccountPlan] = useState<AccountPlanCategoryDto[]>([])
  const [products, setProducts] = useState<ProductDto[]>([])
  const [reviews, setReviews] = useState<ReviewDto[]>([])
  const [product, setProduct] = useState<ProductDetailDto | null>(null)
  const [purchase, setPurchase] = useState<PurchaseDto | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filteredFlow, setFilteredFlow] = useState<DashboardDto | null>(null)
  const [flowLoading, setFlowLoading] = useState(false)

  useEffect(() => {
    clientApi<{ user: UserDto }>('/api/auth/me').then((result) => setUser(result.user)).catch(() => setUser(null)).finally(() => setChecking(false))
  }, [])

  useEffect(() => {
    document.documentElement.dataset.compact = user?.settings.compactMode ? 'true' : 'false'
  }, [user?.settings.compactMode])

  async function reloadAll() {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const data = await fetchAppData(period)
      setDashboard(data.dashboard); setCategories(data.categories); setAccountPlan(data.accountPlan); setProducts(data.products); setReviews(data.reviews)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os dados.') } finally { setLoading(false) }
  }

  useEffect(() => {
    if (!user) return
    let active = true
    fetchAppData(period).then((data) => {
      if (!active) return
      setDashboard(data.dashboard); setCategories(data.categories); setAccountPlan(data.accountPlan); setProducts(data.products); setReviews(data.reviews); setError('')
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os dados.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user, period])

  function navigate(next: AppScreen) { if (next === 'flow') setFilteredFlow(null); setScreen(next); setHistory((current) => [...current, next]) }
  function goBack() { setHistory((current) => { if (current.length <= 1) { setScreen('home'); return ['home'] } const next = current.slice(0, -1); setScreen(next[next.length - 1]); return next }) }

  async function openProduct(id: string) {
    setSelectedProductId(id); setProduct(null); navigate('product')
    try { setProduct(await clientApi<ProductDetailDto>(`/api/products/${id}`)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Produto não encontrado.') }
  }

  async function showSummary(id: string) {
    setSelectedPurchaseId(id)
    setPurchase(await clientApi<PurchaseDto>(`/api/purchases/${id}`))
    setScreen('summary')
    setHistory((current) => [...current, 'summary'])
    await reloadAll()
  }

  function purchaseCreated(id: string) { setSelectedPurchaseId(id); setScreen('processing'); setHistory((current) => [...current, 'processing']) }
  async function reviewConfirmed() { await reloadAll() }
  function changeMonth(delta: number) { setFilteredFlow(null); setPeriod((current) => { const date = new Date(current.year, current.month - 1 + delta, 1); return { year: date.getFullYear(), month: date.getMonth() + 1 } }) }
  async function selectFlowCategory(categoryId: string | null) {
    if (!categoryId) { setFilteredFlow(null); return }
    setFlowLoading(true)
    try {
      const query = '?year=' + period.year + '&month=' + period.month + '&categoryId=' + encodeURIComponent(categoryId)
      setFilteredFlow(await clientApi<DashboardDto>('/api/dashboard' + query))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível abrir essa classificação.')
    } finally {
      setFlowLoading(false)
    }
  }
  async function logout() { await clientApi('/api/auth/logout', { method: 'POST' }); setUser(null); setDashboard(null); setScreen('home'); setHistory(['home']) }

  if (checking) return <div className="grid min-h-dvh place-content-center gap-3 bg-slate-50 text-center text-sm font-bold text-indigo-600"><span className="mx-auto grid h-14 w-14 animate-pulse place-items-center rounded-2xl bg-indigo-600 text-2xl text-white">↗</span>Fluxo de Compras</div>
  if (!user) return <AuthScreen done={(authenticated) => { setUser(authenticated); setScreen('home'); setHistory(['home']) }} />

  const navVisible = !withoutBottomNav.has(screen)
  const selectableCategories = categories.filter((category) => category.active)
  return <main className={`app-shell ${screen === 'add' ? 'app-shell-dark' : ''}`}><section className={`app-surface ${screen === 'add' ? 'bg-[#08080B]' : 'bg-[#F4F6FA]'}`}><div className={`app-viewport ${navVisible ? 'with-nav' : ''}`}><div key={`${screen}-${selectedProductId ?? ''}-${selectedPurchaseId ?? ''}`} className="app-scroll scrollbar-none">
    {loading && !dashboard ? <LoadingState /> : error && !dashboard ? <ErrorState message={error} retry={() => void reloadAll()} /> : <>
      {screen === 'home' && dashboard && <HomeScreen user={user} data={dashboard} reviewCount={reviews.length} navigate={navigate} />}
      {screen === 'profile' && <ProfileScreen user={user} onBack={goBack} updated={setUser} logout={() => void logout()} />}
      {screen === 'flow' && dashboard && <FlowScreen data={filteredFlow ?? dashboard} changeMonth={changeMonth} selectCategory={(id) => void selectFlowCategory(id)} loading={flowLoading} />}
      {screen === 'products' && <ProductsScreen products={products} openProduct={(id) => void openProduct(id)} openCategories={() => navigate('categories')} />}
      {screen === 'categories' && <CategoriesScreen categories={accountPlan} onBack={goBack} changed={reloadAll} openProduct={(id) => void openProduct(id)} />}
      {screen === 'product' && (product ? <ProductDetailScreen product={product} categories={selectableCategories} onBack={goBack} updated={async (next) => { setProduct(next); await reloadAll() }} removed={async () => { setProduct(null); await reloadAll(); goBack() }} /> : <LoadingState label="Carregando histórico…" />)}
      {screen === 'add' && <AddNoteScreen navigate={navigate} onBack={goBack} cameraFacingMode={user.settings.cameraFacingMode} created={purchaseCreated} />}
      {screen === 'manual' && <ManualPurchaseScreen categories={selectableCategories} onBack={goBack} created={purchaseCreated} />}
      {screen === 'text' && <TextPurchaseScreen onBack={goBack} created={purchaseCreated} />}
      {screen === 'processing' && selectedPurchaseId && <ProcessingScreen purchaseId={selectedPurchaseId} done={showSummary} />}
      {screen === 'summary' && <SummaryScreen purchase={purchase} onBack={goBack} navigate={navigate} />}
      {screen === 'reviews' && <ReviewsScreen reviews={reviews} categories={selectableCategories} onBack={goBack} confirmed={reviewConfirmed} />}
    </>}
  </div></div>{navVisible && <BottomNav screen={screen} navigate={navigate} />}</section></main>
}
