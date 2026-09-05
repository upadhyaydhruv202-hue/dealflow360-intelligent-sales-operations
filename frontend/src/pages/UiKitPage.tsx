import { useState } from 'react';

import {
  AiActionButton,
  AiResponseCard,
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  CardTitle,
  Checkbox,
  Drawer,
  Dropdown,
  EmptyState,
  ErrorState,
  FilterPanel,
  Input,
  LoginForm,
  LoadingState,
  Modal,
  PageContainer,
  RadioGroup,
  Search,
  Select,
  Skeleton,
  Tabs,
  Tooltip,
  useToast,
} from '../ui';

export function UiKitPage() {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState(false);
  const [choice, setChoice] = useState('one');

  return (
    <PageContainer
      width="wide"
      breadcrumb={<Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'UI kit' }]} />}
      title="UI kit"
      description="Reusable React + Tailwind primitives. Compose these in hackathon pages. Do not put business rules or Odoo calls inside the components."
    >
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Actions</h2>
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button loading>Saving</Button>
            <Tooltip content="Theme-aware tooltip">
              <Button variant="outline">Hover me</Button>
            </Tooltip>
            <AiActionButton onClick={() => toast({ title: 'AI action queued', variant: 'info' })} />
            <Button onClick={() => setModalOpen(true)}>Open modal</Button>
            <Button variant="outline" onClick={() => setDrawerOpen(true)}>
              Open drawer
            </Button>
            <Dropdown
              trigger={<Button variant="outline">Menu</Button>}
              items={[
                { id: 'one', label: 'First action', onSelect: () => toast({ title: 'First action', variant: 'success' }) },
                { id: 'two', label: 'Destructive', destructive: true, onSelect: () => toast({ title: 'Destructive', variant: 'warning' }) },
              ]}
            />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Input label="Text" placeholder="Type here" hint="Labels stay outside the visual component logic." />
          <Select
            label="Choice"
            placeholder="Select one"
            options={[
              { value: 'a', label: 'Option A' },
              { value: 'b', label: 'Option B' },
            ]}
          />
          <Checkbox label="Agree" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
          <RadioGroup
            name="sample-choice"
            label="Radio"
            value={choice}
            onChange={setChoice}
            options={[
              { value: 'one', label: 'One' },
              { value: 'two', label: 'Two' },
            ]}
          />
        </section>

        <Search value={search} onChange={setSearch} onSubmitSearch={() => toast({ title: `Search: ${search || '(empty)'}`, variant: 'info' })} />

        <FilterPanel title="Filters" onApply={() => toast({ title: 'Filters applied', variant: 'success' })} onReset={() => toast({ title: 'Filters reset' })}>
          <Select label="Status" options={[{ value: 'all', label: 'All' }]} defaultValue="all" />
          <Input label="Owner" placeholder="Any" />
        </FilterPanel>

        <Tabs
          items={[
            { id: 'one', label: 'Overview', content: <p className="text-sm text-foreground-muted">Tab panels are presentational.</p> },
            { id: 'two', label: 'Details', content: <p className="text-sm text-foreground-muted">Put page-specific content here.</p> },
          ]}
        />

        <div className="flex flex-wrap gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="info">Info</Badge>
          <Badge tone="success">Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="danger">Danger</Badge>
        </div>

        <Alert variant="info" title="Informational">
          Alerts are for page-level messages. Toasts are for transient feedback.
        </Alert>

        <div className="grid gap-4 md:grid-cols-3">
          <EmptyState title="Nothing here" description="Pass an action when the user can create a record." />
          <ErrorState title="Request failed" message="The API client maps envelope errors. Retry stays in the page." onRetry={() => toast({ title: 'Retry clicked' })} />
          <Card>
            <CardTitle className="mb-3">Loading</CardTitle>
            <LoadingState />
            <Skeleton className="mt-3" lines={3} />
          </Card>
        </div>

        <AiResponseCard
          content="This card renders model output after the backend validates it. It does not execute tools."
          confidence={0.82}
          evidence={['Cited a retrieved document.', 'Used an allowlisted tool result.']}
          tools={[{ name: 'lookupRecord', status: 'success', riskLevel: 'low' }]}
        />

        <Card className="max-w-md">
          <CardTitle className="mb-3">Login form</CardTitle>
          <LoginForm
            onSubmit={() => toast({ title: 'Submit stays in the page', variant: 'info' })}
            hint="Presentational only. AuthProvider calls POST /api/v1/auth/login."
          />
        </Card>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Example modal" footer={<Button onClick={() => setModalOpen(false)}>Done</Button>}>
        <p className="text-sm text-foreground-muted">Escape, overlay click, and focus return are built in.</p>
      </Modal>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Example drawer">
        <p className="text-sm text-foreground-muted">Use drawers for filters or secondary detail. Keep submit logic in the page.</p>
      </Drawer>
    </PageContainer>
  );
}
